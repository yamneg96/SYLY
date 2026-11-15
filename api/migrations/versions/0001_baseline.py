"""Baseline: the tables that existed before the developer portal (SDS 2.3).

Each table is created only if it is missing, so a database made by an earlier version
(which created tables on start-up) is adopted as it is, without losing data.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

TS = sa.DateTime(timezone=True)


def _create(name: str, *cols, indexes: tuple[str, ...] = ()) -> None:
    if sa.inspect(op.get_bind()).has_table(name):
        return
    op.create_table(name, *cols)
    for col in indexes:
        op.create_index(f"ix_{name}_{col}", name, [col])


def upgrade() -> None:
    _create("sections", sa.Column("id", sa.String(200), primary_key=True), sa.Column("kind", sa.String(20)),
            sa.Column("url", sa.String(500)), sa.Column("data", sa.JSON()))
    _create("questions", sa.Column("id", sa.Integer, primary_key=True), sa.Column("conversation_id", sa.String(64)),
            sa.Column("text", sa.Text), sa.Column("language", sa.String(8)), sa.Column("section_id", sa.String(200), nullable=True),
            sa.Column("provider", sa.String(20)), sa.Column("consent_ai", sa.Boolean), sa.Column("created_at", TS),
            indexes=("conversation_id",))
    _create("tickets", sa.Column("id", sa.Integer, primary_key=True), sa.Column("conversation_id", sa.String(64), nullable=True),
            sa.Column("channel", sa.String(20)), sa.Column("status", sa.String(20)), sa.Column("language", sa.String(8)),
            sa.Column("page_url", sa.String(1000), nullable=True), sa.Column("section", sa.String(200), nullable=True),
            sa.Column("screenshot", sa.Text, nullable=True), sa.Column("notify_enc", sa.Text, nullable=True),
            sa.Column("helper_name", sa.String(80), nullable=True), sa.Column("access_token", sa.String(64)),
            sa.Column("created_at", TS), indexes=("conversation_id",))
    _create("messages", sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("ticket_id", sa.Integer, sa.ForeignKey("tickets.id", ondelete="CASCADE")),
            sa.Column("author", sa.String(20)), sa.Column("name", sa.String(80), nullable=True), sa.Column("text", sa.Text),
            sa.Column("lang", sa.String(8), nullable=True), sa.Column("sources", sa.JSON()), sa.Column("created_at", TS),
            indexes=("ticket_id",))
    _create("jobs", sa.Column("id", sa.String(100), primary_key=True), sa.Column("data", sa.JSON()), sa.Column("created_at", TS))
    _create("alerts", sa.Column("id", sa.Integer, primary_key=True), sa.Column("channel", sa.String(20)),
            sa.Column("address_enc", sa.Text), sa.Column("address_hash", sa.String(64)), sa.Column("keyword", sa.String(100)),
            sa.Column("location", sa.String(100)), sa.Column("language", sa.String(8)), sa.Column("created_at", TS),
            indexes=("address_hash",))
    _create("outbox", sa.Column("id", sa.Integer, primary_key=True), sa.Column("to_enc", sa.Text),
            sa.Column("text", sa.String(160)), sa.Column("created_at", TS))
    _create("accommodations", sa.Column("id", sa.Integer, primary_key=True), sa.Column("job_id", sa.String(100)),
            sa.Column("needs", sa.JSON()), sa.Column("note", sa.Text, nullable=True), sa.Column("contact_channel", sa.String(20)),
            sa.Column("contact_enc", sa.Text, nullable=True), sa.Column("language", sa.String(8)), sa.Column("status", sa.String(20)),
            sa.Column("created_at", TS))
    _create("webhooks", sa.Column("id", sa.Integer, primary_key=True), sa.Column("url", sa.String(1000)),
            sa.Column("events", sa.JSON()), sa.Column("created_at", TS))
    _create("helper_presence", sa.Column("id", sa.Integer, primary_key=True), sa.Column("name", sa.String(80)),
            sa.Column("seen_at", TS))


def downgrade() -> None:
    for name in ("helper_presence", "webhooks", "accommodations", "outbox", "alerts", "jobs", "messages", "tickets",
                 "questions", "sections"):
        op.drop_table(name)
