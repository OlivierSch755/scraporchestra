CC := gcc

CFLAGS := -Wall -Wextra -O2
CFLAGS += $(shell pkg-config --cflags alsa)

LDLIBS := $(shell pkg-config --libs alsa)

TARGET := bin/midish-bridge
SRC := src/bridge.c

MIDISH_VERSION := 1.4.1
MIDISH_URL := https://midish.org/midish-$(MIDISH_VERSION).tar.gz

DEPS := third_party
MIDISH_ROOT := $(DEPS)/midish
MIDISH_SRC := $(MIDISH_ROOT)/source
MIDISH_BIN := bin/midish

.PHONY: all midish-bridge midish clean distclean

all: midish-bridge midish

midish-bridge: $(TARGET)

$(TARGET): $(SRC)
	mkdir -p $(@D)
	$(CC) $(CFLAGS) $^ $(LDLIBS) -o $@

midish: $(MIDISH_BIN)

$(MIDISH_SRC):
	mkdir -p $(MIDISH_ROOT)
	wget -O $(MIDISH_ROOT)/midish.tar.gz $(MIDISH_URL)
	tar -xzf $(MIDISH_ROOT)/midish.tar.gz -C $(MIDISH_ROOT)
	mv $(MIDISH_ROOT)/midish-$(MIDISH_VERSION) $(MIDISH_SRC)
	rm $(MIDISH_ROOT)/midish.tar.gz

$(MIDISH_BIN): $(MIDISH_SRC)
	cd $(MIDISH_SRC) && \
		./configure
	$(MAKE) -C $(MIDISH_SRC)
	mkdir -p $(@D)
	cp $(MIDISH_SRC)/midish $@

clean:
	rm -rf third_party
	
distclean:
	rm -rf bin third_party