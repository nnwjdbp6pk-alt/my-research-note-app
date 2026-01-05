"""Initial schema

Revision ID: 0001_init
Revises: 
Create Date: 2024-01-01 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = '0001_init'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('project_type', sa.String(length=20), nullable=False),
        sa.Column('expected_end_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_table(
        'result_schemas',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=80), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=False),
        sa.Column('value_type', sa.String(length=30), nullable=False),
        sa.Column('unit', sa.String(length=40), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('options', sqlite.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_result_schemas_project_id'), 'result_schemas', ['project_id'], unique=False)
    op.create_table(
        'output_configs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('included_keys', sqlite.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_output_configs_project_id'), 'output_configs', ['project_id'], unique=False)
    op.create_table(
        'experiments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('author', sa.String(length=80), nullable=False),
        sa.Column('purpose', sa.Text(), nullable=False),
        sa.Column('materials', sqlite.JSON(), nullable=False),
        sa.Column('result_values', sqlite.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_experiments_project_id'), 'experiments', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_experiments_project_id'), table_name='experiments')
    op.drop_table('experiments')
    op.drop_index(op.f('ix_output_configs_project_id'), table_name='output_configs')
    op.drop_table('output_configs')
    op.drop_index(op.f('ix_result_schemas_project_id'), table_name='result_schemas')
    op.drop_table('result_schemas')
    op.drop_table('projects')
