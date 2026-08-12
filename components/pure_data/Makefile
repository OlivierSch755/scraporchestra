PURE_DATA_VERSION := 0.56-5
PURE_DATA_URL := https://github.com/pure-data/pure-data/archive/refs/tags/$(PURE_DATA_VERSION).tar.gz

DEPS := third_party
PURE_DATA_ROOT := $(DEPS)/pure-data
PURE_DATA_SRC := $(PURE_DATA_ROOT)/source
PURE_DATA_PREFIX := $(abspath install)

PURE_DATA_BIN := $(PURE_DATA_PREFIX)/bin/pd

PURE_DATA_CONFIGURE_FLAGS := \
	--disable-oss \
	--disable-jack \
	--disable-wasapi \
	--disable-sgi \
	--disable-portaudio

.PHONY: all pure-data clean

all: pure-data

pure-data: $(PURE_DATA_BIN)

$(PURE_DATA_SRC):
	mkdir -p $(PURE_DATA_ROOT)
	wget -O $(PURE_DATA_ROOT)/pure-data.tar.gz $(PURE_DATA_URL)
	tar -xzf $(PURE_DATA_ROOT)/pure-data.tar.gz -C $(PURE_DATA_ROOT)
	mv $(PURE_DATA_ROOT)/pure-data-$(PURE_DATA_VERSION) $(PURE_DATA_SRC)
	rm $(PURE_DATA_ROOT)/pure-data.tar.gz

$(PURE_DATA_BIN): $(PURE_DATA_SRC)
	cd $(PURE_DATA_SRC) && ./autogen.sh
	cd $(PURE_DATA_SRC) && \
		./configure \
		$(PURE_DATA_CONFIGURE_FLAGS) \
		--prefix="$(PURE_DATA_PREFIX)"
	$(MAKE) -C $(PURE_DATA_SRC)
	$(MAKE) -C $(PURE_DATA_SRC) install

clean:
	rm -rf third_party
	
distclean:
	rm -rf install third_party