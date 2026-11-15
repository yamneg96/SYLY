"""Run the migrations to the latest version (called on API start-up; also usable from a shell)."""

from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

log = logging.getLogger("syly")


def upgrade_to_head() -> None:
    cfg = Config(str(Path(__file__).with_name("alembic.ini")))
    cfg.set_main_option("script_location", str(Path(__file__).with_name("migrations")))
    command.upgrade(cfg, "head")
    log.info("database is at the latest migration")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    upgrade_to_head()
