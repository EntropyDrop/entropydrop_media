#!/usr/bin/env python3
"""Compatibility entry point: update the persistent modular project."""
import sys
from video import main
if __name__ == '__main__':
    sys.argv = [sys.argv[0], 'assemble']
    main()
