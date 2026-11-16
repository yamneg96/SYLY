"""Tutor accounts: sign-in codes, tutor presence, and what a request remembers (site, who took it, reminder).

Every step checks first whether it is already there, so a database whose tables were made from the newest models is adopted as it is.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def _columns(table: str) -> set[str]:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def _has_table(table: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table)


def _has_index(table: str, name: str) -> bool:
    return any(i["name"] == name for i in sa.inspect(op.get_bind()).get_indexes(table))


def upgrade() -> None:
    have = _columns("tickets")
    for name, col in (
        ("site_key", sa.Column("site_key", sa.String(40), nullable=True)),
        ("helper_email", sa.Column("helper_email", sa.String(320), nullable=True)),
        ("accepted_at", sa.Column("accepted_at", TS, nullable=True)),
        ("reminded_at", sa.Column("reminded_at", TS, nullable=True)),
    ):
        if name not in have:
            op.add_column("tickets", col)
    if not _has_index("tickets", "ix_tickets_site_key"):
        op.create_index("ix_tickets_site_key", "tickets", ["site_key"])

    if not _has_table("tutor_codes"):
        op.create_table(
            "tutor_codes",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("email", sa.String(320), nullable=False),
            sa.Column("code_hash", sa.String(64), nullable=False),
            sa.Column("expires_at", TS, nullable=False),
            sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
            sa.Column("used", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("created_at", TS, nullable=False),
        )
        op.create_index("ix_tutor_codes_email", "tutor_codes", ["email"])
    if not _has_table("tutor_presence"):
        op.create_table(
            "tutor_presence",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("email", sa.String(320), nullable=False),
            sa.Column("name", sa.String(80), nullable=False, server_default=""),
            sa.Column("status", sa.String(12), nullable=False, server_default="away"),
            sa.Column("seen_at", TS, nullable=False),
        )
        op.create_index("ix_tutor_presence_email", "tutor_presence", ["email"], unique=True)


def downgrade() -> None:
    op.drop_table("tutor_presence")
    op.drop_table("tutor_codes")
    op.drop_index("ix_tickets_site_key", table_name="tickets")
    for col in ("reminded_at", "accepted_at", "helper_email", "site_key"):
        op.drop_column("tickets", col)
