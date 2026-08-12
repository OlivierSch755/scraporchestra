#include <alsa/asoundlib.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <poll.h>
#include <errno.h>

static volatile sig_atomic_t running = 1;


static void stop_handler(int sig)
{
    running = 0;
}


int main(void)
{
    snd_seq_t *seq;
    snd_seq_event_t *ev;
    snd_seq_event_t out;

    int client;

    int midish_send;
    int midish_receive;

    int external_send;
    int external_receive;


    signal(SIGINT, stop_handler);
    signal(SIGTERM, stop_handler);


    /*
     * Open ALSA sequencer
     */
    if (snd_seq_open(&seq,
                     "default",
                     SND_SEQ_OPEN_DUPLEX,
                     0) < 0) {

        fprintf(stderr,
                "cannot open ALSA sequencer\n");
        return 1;
    }


    /*
     * Permanent ALSA client name
     */
    snd_seq_set_client_name(seq,
                            "Midish-Transport");

    client = snd_seq_client_id(seq);




    /*
     * External MIDI devices send here
     *
     * keyboard/controller -> bridge
     */
    external_send = snd_seq_create_simple_port(
        seq,
        "midi-in",
        SND_SEQ_PORT_CAP_WRITE |
        SND_SEQ_PORT_CAP_SUBS_WRITE,
        SND_SEQ_PORT_TYPE_MIDI_GENERIC
    );


    /*
     * External MIDI devices receive here
     *
     * bridge -> synth/device
     */
    external_receive = snd_seq_create_simple_port(
        seq,
        "midi-out",
        SND_SEQ_PORT_CAP_READ |
        SND_SEQ_PORT_CAP_SUBS_READ,
        SND_SEQ_PORT_TYPE_MIDI_GENERIC
    );


    /*
     * midish OUT connects here
     *
     * midish -> bridge
     */
    midish_send = snd_seq_create_simple_port(
        seq,
        "midish-internal-send",
        SND_SEQ_PORT_CAP_WRITE |
        SND_SEQ_PORT_CAP_SUBS_WRITE,
        SND_SEQ_PORT_TYPE_MIDI_GENERIC
    );


    /*
     * midish IN connects here
     *
     * bridge -> midish
     */
    midish_receive = snd_seq_create_simple_port(
        seq,
        "midish-internal-receive",
        SND_SEQ_PORT_CAP_READ |
        SND_SEQ_PORT_CAP_SUBS_READ,
        SND_SEQ_PORT_TYPE_MIDI_GENERIC
    );




    if (midish_send < 0 ||
        midish_receive < 0 ||
        external_send < 0 ||
        external_receive < 0) {

        fprintf(stderr,
                "cannot create ports\n");

        snd_seq_close(seq);
        return 1;
    }


    printf("midish-bridge running\n");
    printf("client %d\n", client);


    /*
     * Setup poll()
     */
    struct pollfd pfds[16];

    int npfd =
        snd_seq_poll_descriptors_count(seq,
                                       POLLIN);


    if (npfd > 16) {

        fprintf(stderr,
                "too many poll descriptors\n");

        snd_seq_close(seq);
        return 1;
    }


    snd_seq_poll_descriptors(seq,
                             pfds,
                             npfd,
                             POLLIN);



    /*
     * Main event loop
     */
    while (running) {

        int ret = poll(pfds,
                       npfd,
                       -1);


        if (ret < 0) {

            if (errno == EINTR)
                continue;

            perror("poll");
            break;
        }



        /*
         * Drain all waiting MIDI events
         */
        while (snd_seq_event_input_pending(seq, 1) > 0) {


            if (snd_seq_event_input(seq, &ev) < 0)
                break;


			// printf("event type=%d source=%d:%d dest=%d:%d\n",
				   // ev->type,
				   // ev->source.client,
				   // ev->source.port,
				   // ev->dest.client,
				   // ev->dest.port);
			// fflush(stdout);

            /*
             * Copy event
             */
            out = *ev;

			//midish -> external
			if (ev->dest.port == midish_send) {

				out = *ev;

				snd_seq_ev_set_source(&out,  external_receive);
				snd_seq_ev_set_subs(&out);

				snd_seq_event_output_direct(seq, &out);
			}
			else if (ev->dest.port == external_send) {

				out = *ev;

				snd_seq_ev_set_source(&out,
									  midish_receive);

				snd_seq_ev_set_subs(&out);
				snd_seq_ev_set_direct(&out);

				snd_seq_event_output_direct(seq, &out);
			}

        }
    }


    printf("stopping midish-bridge\n");


    snd_seq_close(seq);

    return 0;
}