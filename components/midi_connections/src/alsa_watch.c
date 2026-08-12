#include <alsa/asoundlib.h>
#include <stdio.h>

int seq_client_id;
snd_seq_t *seq;

static void list_each_subs(snd_seq_t *seq, snd_seq_query_subscribe_t *subs, int type, const snd_seq_addr_t *self_addr)
{
	snd_seq_query_subscribe_set_type(subs, type);
	snd_seq_query_subscribe_set_index(subs, 0);
	while (snd_seq_query_port_subscribers(seq, subs) >= 0) {
		const snd_seq_addr_t *addr;
		
		addr = snd_seq_query_subscribe_get_addr(subs);
		printf("LINK %d %d %d %d\n", self_addr->client, self_addr->port, addr->client, addr->port);
		snd_seq_query_subscribe_set_index(subs, snd_seq_query_subscribe_get_index(subs) + 1);
	}
}

static void list_subscribers(snd_seq_t *seq, const snd_seq_addr_t *addr)
{
	snd_seq_query_subscribe_t *subs;
	snd_seq_query_subscribe_alloca(&subs);
	snd_seq_query_subscribe_set_root(subs, addr);
	list_each_subs(seq, subs, SND_SEQ_QUERY_SUBS_READ, addr );
}

static void print_port(
	snd_seq_client_info_t *cinfo,
	snd_seq_port_info_t *pinfo, int count)
{
	
	int client_id = snd_seq_client_info_get_client(cinfo);
	
	if (! count) {
		
		int card = -1, pid = -1;

		char type = 0;
		card = snd_seq_client_info_get_card(cinfo);
		if (card != -1){
			type = 1;
		}
		else{
			pid = snd_seq_client_info_get_pid(cinfo);
			if (pid != -1) type = 2;
		}

		printf("CLIENT %d %d %s\n",
		       client_id,
		       type,
		       snd_seq_client_info_get_name(cinfo)
	   );
			
	}
	
	printf("PORT %d %d %d %s\n",
	   client_id,
	   snd_seq_port_info_get_port(pinfo),
	   snd_seq_port_info_get_direction(pinfo),
	   snd_seq_port_info_get_name(pinfo)
   );
}

static void print_port_and_subs(snd_seq_t *seq, snd_seq_client_info_t *cinfo,
				snd_seq_port_info_t *pinfo, int count)
{
	print_port(cinfo, pinfo, count);
	list_subscribers(seq, snd_seq_port_info_get_addr(pinfo));
}

static int filter_port(snd_seq_port_info_t *pinfo){


	const snd_seq_addr_t *addr = snd_seq_port_info_get_addr(pinfo);

	// don't show system
	if (addr->client == SND_SEQ_CLIENT_SYSTEM)
		return 0;
	
	// don't show ourselves
	if (addr->client == seq_client_id)
		return 0;
	
	int cap = snd_seq_port_info_get_capability(pinfo);
	
	// don't show ports that you can't manage from outside 
	if (cap & SND_SEQ_PORT_CAP_NO_EXPORT)
		return 0;
	
	// only show ports that accept subscribe (aconnect ...)
	return  ( ( cap & ( SND_SEQ_PORT_CAP_SUBS_READ | SND_SEQ_PORT_CAP_SUBS_WRITE ) ) );

}

static void do_search_port(snd_seq_t *seq)
{
	snd_seq_client_info_t *cinfo;
	snd_seq_port_info_t *pinfo;
	int count;

	snd_seq_client_info_alloca(&cinfo);
	snd_seq_port_info_alloca(&pinfo);
	snd_seq_client_info_set_client(cinfo, -1);
	
	
	printf("SNAP\n");
	
	while (snd_seq_query_next_client(seq, cinfo) >= 0) {
		/* reset query info */
		snd_seq_port_info_set_client(pinfo, snd_seq_client_info_get_client(cinfo));
		snd_seq_port_info_set_port(pinfo, -1);
		count = 0;
		while (snd_seq_query_next_port(seq, pinfo) >= 0) {
			if (filter_port(pinfo)) {
				print_port_and_subs(seq, cinfo, pinfo, count);
				count++;
			}
		}
	}
	
	printf("END\n");
	fflush(stdout);
}



int main(void)
{

	
	int err = 0;
	
	// open alsa sequencer and create client
	err = snd_seq_open(&seq, "default", SND_SEQ_OPEN_DUPLEX, 0);
	if(err < 0){
		return 1;
	}
	
	// get client id
	seq_client_id = snd_seq_client_id(seq);
	if(seq_client_id < 0){
		return 1;
	}

	// set client name
	err = snd_seq_set_client_name(seq, "scrap_midi_monitor");
	if(err < 0){
		return 1;
	}
	
	// create port
    int evtPort = snd_seq_create_simple_port(seq, "watcher",
    SND_SEQ_PORT_CAP_WRITE | SND_SEQ_PORT_CAP_NO_EXPORT,
    SND_SEQ_PORT_TYPE_APPLICATION);

	if(evtPort < 0){
		return 1;
	}
	
	// subscribe our port to sequencer announces
	err = snd_seq_connect_from(seq, evtPort, SND_SEQ_CLIENT_SYSTEM, SND_SEQ_PORT_SYSTEM_ANNOUNCE);
	if(err < 0){
		return 1;
	}
	
	
	do_search_port(seq);

	while (1) {
		snd_seq_event_t *ev;
		if (snd_seq_event_input(seq, &ev) < 0){
			continue;
		}
		
		
		switch (ev->type) {
			
			case SND_SEQ_EVENT_PORT_EXIT:
			case SND_SEQ_EVENT_PORT_START:
			case SND_SEQ_EVENT_PORT_CHANGE:
				do_search_port(seq);
				break;
			case SND_SEQ_EVENT_PORT_UNSUBSCRIBED:
			case SND_SEQ_EVENT_PORT_SUBSCRIBED:
				if (ev->data.connect.dest.client == seq_client_id || ev->data.connect.sender.client == seq_client_id)
					break;
				do_search_port(seq);
			break;
		}
	}
	return 0;
}