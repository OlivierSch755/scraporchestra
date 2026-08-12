CC := gcc
CFLAGS := -Wall -Wextra -O2

CFLAGS += $(shell pkg-config --cflags alsa)
LDLIBS += $(shell pkg-config --libs alsa)

TARGET := bin/alsa_watch
SRC := src/alsa_watch.c

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRC)
	mkdir -p $(@D)
	$(CC) $(CFLAGS) $< -o $@ $(LDLIBS)

distclean:
	rm -rf bin