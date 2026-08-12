COMPONENTS := $(wildcard ./*)

.PHONY: all clean distclean

all:
	@for dir in $(COMPONENTS); do \
		if [ -f "$$dir/Makefile" ]; then \
			echo "==> Building $$dir"; \
			$(MAKE) -C "$$dir"; \
		fi \
	done

clean:
	@for dir in $(COMPONENTS); do \
		if [ -f "$$dir/Makefile" ]; then \
			echo "==> Cleaning $$dir"; \
			$(MAKE) -C "$$dir" clean; \
		fi \
	done

distclean:
	@for dir in $(COMPONENTS); do \
		if [ -f "$$dir/Makefile" ]; then \
			echo "==> Cleaning $$dir"; \
			$(MAKE) -C "$$dir" distclean; \
		fi \
	done
