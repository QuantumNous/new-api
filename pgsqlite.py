from sqlite_utils import Database
from typing import List, Any, Dict, Union, Optional
import sqlite_utils
import datetime
import sqlglot
import json
import sqlite3
import psycopg
from psycopg.rows import dict_row
from pprint import pprint
from psycopg.sql import SQL, Identifier, Literal
import sys
import logging
import structlog
import argparse
import asyncio
import re


_IGNORE_CHECKS = True
_IGNORE_TRIGGERS = True
_IGNORE_VIEWS = True
SQLITE_SYSTEM_TABLES = ["sqlite_sequence", "sqlite_stat1", "sqlite_user"]

# ============================================================
# new-api project specific configuration
# ============================================================

# Explicit boolean columns in the new-api schema.
# Maps: table_name -> set of column names that should be boolean.
# Derived from Go struct definitions (type bool / *bool only).
# IMPORTANT: Only include Go bool/*bool columns. Columns with *int/int Go types
# (like channels.auto_ban) must stay as integer to avoid GORM AutoMigrate
# reverting them on next startup.
NEW_API_BOOLEAN_COLUMNS: Dict[str, set] = {
    "abilities": {"enabled"},
    "tokens": {"unlimited_quota", "model_limits_enabled", "cross_group_retry"},
    "logs": {"is_stream"},
    "subscription_plans": {"enabled", "allow_balance_pay", "allow_wallet_overflow"},
    "user_subscriptions": {"allow_wallet_overflow"},
    "two_fas": {"is_enabled"},
    "two_fa_backup_codes": {"is_used"},
    "custom_oauth_providers": {"enabled"},
    "passkey_credentials": {"clone_warning", "user_present", "user_verified",
                            "backup_eligible", "backup_state"},
}

# Heuristic boolean column name patterns (applied to any table).
# Columns whose name matches these patterns AND whose SQLite type is numeric/integer
# will be converted to boolean in PostgreSQL.
BOOLEAN_COLUMN_NAME_PATTERNS = [
    r".*_enabled$",
    r".*_allow$",
    r"^is_.*",
    r"^has_.*",
    r".*_active$",
    r".*_retry$",
    r"^allow_.*",
    r".*_present$",
    r".*_verified$",
    r".*_eligible$",
    r".*_warning$",
    r".*_state$",
    r"^unlimited_.*",
    r"^cross_group_.*",
    r".*_overflow$",
    r".*_pay$",
]

# Columns whose name matches "is_used" — uses a tighter pattern than .*_used$
# because .*_used would incorrectly match sum() counters like token_used, amount_used.
BOOLEAN_COLUMN_NAME_PATTERNS_EXACT = [
    r"^is_used$",
]

# Columns that should be converted from TEXT to JSONB in PostgreSQL.
# Excludes:
#   - channel_info, tasks.properties/private_data/data, prefill_groups.items — already type:json in GORM
#   - models.description, vendors.description — plain text (free-text search)
#   - passkey_credentials.public_key — base64-encoded CBOR binary, not JSON
NEW_API_JSON_COLUMNS: Dict[str, set] = {
    "channels": {"model_mapping", "setting", "param_override", "header_override"},
    "users": {"setting"},
    "passkey_credentials": {"transports"},
    "custom_oauth_providers": {"access_policy"},
    "models": {"endpoints"},
}

# Tables that use SQLite-specific DDL with numeric(1) for booleans
# (created via ensureSubscriptionPlanTableSQLite in model/main.go).
# These need special handling during DEFAULT value conversion.
SQLITE_SPECIFIC_DDL_TABLES = {"subscription_plans"}

# Per-column boolean defaults (table_name -> {col_name: postgres_default}).
# Used when the Go model's gorm default differs from the standard DEFAULT false.
BOOLEAN_COLUMN_DEFAULTS: Dict[str, Dict[str, str]] = {
    "subscription_plans": {
        "enabled": "true",               # gorm:"default:true"
        "allow_balance_pay": "true",     # SQLite DDL: numeric DEFAULT 1
        "allow_wallet_overflow": "true", # SQLite DDL: numeric DEFAULT 1
    },
}

# Reserved SQL keywords that need quoting in PostgreSQL.
PG_RESERVED_WORDS = {"group", "key", "order", "user", "table", "column", "select", "from", "where"}

logger = structlog.get_logger(__name__)


class SchemaError(Exception):
    """Raise for schema conditions that are invalid for pgsqlite"""
    pass


# We currently use both sqlite_utils and sqglot to extract and transpile database
# schemas. ParsedTable (ParsedColumn) wraps both representations of each table
# (column) object so that equivalent objects remain synced.
class ParsedTable(object):
    """Wraps a parsed sqlite_utils.db.Table and exposes transpiled identifiers."""

    def __init__(self, table: sqlite_utils.db.Table):
        self.src_table = table
        self.parsed_table = sqlglot.parse_one(table.schema, read="sqlite")
        table_identifier = (self.parsed_table.find(sqlglot.exp.Table)
                                             .find(sqlglot.exp.Identifier))
        self._tsp_table_name = table_identifier.this
        if not table_identifier.quoted:
            self._tsp_table_name = self._tsp_table_name.lower()
        parsed_cols = []
        for exp in self.parsed_table.this.expressions:
            if isinstance(exp, sqlglot.exp.ColumnDef):
                parsed_cols.append(exp)
            elif isinstance(exp, sqlglot.exp.Identifier):
                col_def = sqlglot.exp.ColumnDef(
                    this=exp,
                    kind=sqlglot.exp.DataType(
                        this=sqlglot.exp.DataType.Type.TEXT
                    ),
                )
                parsed_cols.append(col_def)
        if len(self.src_table.columns) != len(parsed_cols):
            raise SchemaError(f"sqlite_utils and sqlglot disagree on number of columns in table {self.source_name}")
        self._columns = {
            col.name: ParsedColumn(col, parsed_col)
            for col, parsed_col in zip(self.src_table.columns, parsed_cols)
        }

    @property
    def source_name(self):
        return self.src_table.name

    @property
    def transpiled_name(self):
        return self._tsp_table_name

    @property
    def columns(self):
        return self._columns.values()

    def get_transpiled_colname(self, source_colname: str) -> str:
        try:
            return self._columns[source_colname].transpiled_name
        except KeyError as e:
            raise ValueError("Requested transpiled name for unrecognized source column") from e


class ParsedColumn(object):
    """Wraps a parsed column and exposes source and transpiled identifiers."""

    def __init__(self, column: sqlite_utils.db.Column, parsed_column: sqlglot.expressions.ColumnDef):
        self.src_column = column
        if (fk := parsed_column.find(sqlglot.exp.Reference)):
            fk.pop()
        self.parsed_column = parsed_column
        column_identifier = self.parsed_column.find(sqlglot.expressions.Identifier)
        self._tsp_column_name = column_identifier.this
        if not column_identifier.quoted:
            self._tsp_column_name = self._tsp_column_name.lower()

    @property
    def source_name(self):
        return self.src_column.name

    @property
    def transpiled_name(self):
        return self._tsp_column_name


class PGSqlite(object):
    async def gather_with_concurrency(self, max_coros: int, *coros: Any) -> Any:
        semaphore = asyncio.Semaphore(max_coros)
        async def sem_task(coro):
            async with semaphore:
                return await coro
        return await asyncio.gather(*(sem_task(coro) for coro in coros))

    def boolean_transformer(self, val: Any, nullable: bool) -> Union[bool, None]:
        if nullable and not val:
            return None
        if not nullable and not val:
            raise Exception("Value is None but column is not nullable")
        if val == 1 or val.lower() == "true":
            return "TRUE"
        return "FALSE"

    def __init__(self, sqlite_filename: str, pg_conninfo: str,
                 show_sample_data: bool = False, max_import_concurrency: int = 10,
                 dry_run: bool = False,
                 boolean_columns: Optional[Dict[str, set]] = None,
                 json_columns: Optional[Dict[str, set]] = None,
                 skip_boolean_conversion: bool = False,
                 skip_json_conversion: bool = False) -> None:
        self.sqlite_filename = sqlite_filename
        self.pg_conninfo = pg_conninfo
        self._tables = None
        self.tables_sql = []
        self.fks_sql = []
        self.indexes_sql = []
        self.checks_sql_by_table = {}
        self.summary = {}
        self.summary["tables"] = {}
        self.summary["tables"]["columns"] = {}
        self.summary["tables"]["pks"] = {}
        self.summary["tables"]["fks"] = {}
        self.summary["tables"]["checks"] = {}
        self.summary["tables"]["data"] = {}
        self.summary["tables"]["indexes"] = {}
        self.summary["views"] = {}
        self.summary["triggers"] = {}
        self.transformers = {}
        self.transformers['BOOLEAN'] = self.boolean_transformer
        self.show_sample_data = show_sample_data
        self.max_import_concurrency = max_import_concurrency
        self.dry_run = dry_run
        self.boolean_columns = boolean_columns or {}
        self.json_columns = json_columns or {}
        self.skip_boolean_conversion = skip_boolean_conversion
        self.skip_json_conversion = skip_json_conversion
        db = Database(self.sqlite_filename)
        self._tables = {t.name: ParsedTable(t) for t in db.tables}

    @property
    def tables(self):
        return self._tables.values()

    def get_transpiled_tablename(self, source_tablename: str) -> str:
        try:
            return self._tables[source_tablename].transpiled_name
        except KeyError as e:
            raise ValueError("Requested transpiled name for unrecognized source table") from e

    def get_transpiled_colname(self, source_tablename: str, source_colname: str) -> str:
        try:
            return self._tables[source_tablename].get_transpiled_colname(source_colname)
        except KeyError as e:
            raise ValueError("Requested transpiled name for unrecognized source table") from e

    def _quote_identifier(self, name: str) -> str:
        """Quote identifier if it is a PostgreSQL reserved word or contains special chars."""
        if name.lower() in PG_RESERVED_WORDS or not name.isidentifier():
            return f'"{name}"'
        return name

    def _is_boolean_column(self, table_name: str, col_name: str, col_type: str) -> bool:
        """Determine if a column should be treated as boolean in PostgreSQL.

        Priority: explicit mapping > heuristic pattern matching on column name.
        """
        # Check explicit mapping first
        if table_name in self.boolean_columns:
            if col_name in self.boolean_columns[table_name]:
                return True

        # Check heuristic patterns
        col_lower = col_name.lower()
        # Only convert numeric/integer/smallint columns (SQLite has no real boolean type)
        type_upper = col_type.upper() if col_type else ""
        if type_upper in ("NUMERIC", "INTEGER", "INT", "SMALLINT", "TINYINT", "BIGINT", ""):
            for pattern in BOOLEAN_COLUMN_NAME_PATTERNS:
                if re.match(pattern, col_lower):
                    return True
            for pattern in BOOLEAN_COLUMN_NAME_PATTERNS_EXACT:
                if re.match(pattern, col_lower):
                    return True

        return False

    def _is_json_column(self, table_name: str, col_name: str) -> bool:
        """Determine if a TEXT column stores JSON and should be converted to JSONB."""
        if table_name in self.json_columns:
            return col_name in self.json_columns[table_name]
        return False

    def get_table_sql(self, table: ParsedTable) -> SQL:
        create_sql = SQL("CREATE TABLE {table_name} (").format(
            table_name=Identifier(table.transpiled_name)
        )
        columns_sql = []
        cols = {}
        already_created_pks = []
        for col in table.columns:
            col_sql_str = col.parsed_column.sql(dialect="postgres")
            if "SERIAL" in col_sql_str:
                col_sql_str = col_sql_str.replace("INT", "")
            if "PRIMARY KEY SERIAL" in col_sql_str:
                col_sql_str = col_sql_str.replace("PRIMARY KEY SERIAL", "SERIAL PRIMARY KEY")
            cols[col.source_name] = SQL(col_sql_str)
            if "PRIMARY KEY" in col_sql_str:
                already_created_pks.append(col.source_name)

        for column in table.columns:
            columns_sql.append(cols[column.source_name])
        self.summary["tables"]["columns"][table.source_name] = {
            "status": "PREPARED",
            "count": len(table.columns),
        }
        all_column_sql = SQL(",\n").join(columns_sql)

        pks_to_add = set(table.src_table.pks) - set(already_created_pks)
        if pks_to_add and not table.src_table.use_rowid:
            transpiled_pks_to_add = [table.get_transpiled_colname(pk) for pk in pks_to_add]
            all_column_sql = all_column_sql + SQL(",\n")
            pk_name = f"PK_{table.source_name}_" + ''.join(pks_to_add)
            pk_sql = SQL("    CONSTRAINT {pk_name} PRIMARY KEY ({pks})").format(
                    table_name=Identifier(table.transpiled_name),
                    pk_name=Identifier(pk_name), pks=SQL(", ").join(
                        [Identifier(t) for t in transpiled_pks_to_add]
                    ),
            )
            all_column_sql = SQL("    ").join([all_column_sql, pk_sql])
        self.summary["tables"]["pks"][table.source_name] = {
            "status": "PREPARED",
            "count": len(table.src_table.pks),
        }

        self.summary["tables"]["checks"][table.source_name] = {}
        if self.checks_sql_by_table[table.source_name] and not _IGNORE_CHECKS:
            all_column_sql = all_column_sql + SQL(",\n")
            check_sql = SQL(",\n").join(self.checks_sql_by_table[table.source_name])
            all_column_sql = SQL("").join([all_column_sql, check_sql])
            self.summary["tables"]["checks"][table.source_name]["status"] = "PREPARED"
        else:
            self.summary["tables"]["checks"][table.source_name]["status"] = "IGNORED"
        self.summary["tables"]["checks"][table.source_name]["count"] = len(
            self.checks_sql_by_table[table.source_name]
        )

        create_sql = SQL("\n").join([create_sql, all_column_sql, SQL(");")])
        return create_sql

    def get_fk_sql(self, table: ParsedTable) -> SQL:
        sql = []
        for fk in table.src_table.foreign_keys:
            fk_name = f"FK_{fk.other_table}_{fk.other_column}"
            fk_sql = SQL(
                "ALTER TABLE {table_name} ADD CONSTRAINT {key_name} "
                "FOREIGN KEY ({column}) REFERENCES {other_table} ({other_column})"
            ).format(
                table_name=Identifier(table.transpiled_name),
                column=Identifier(table.get_transpiled_colname(fk.column)),
                key_name=Identifier(fk_name),
                other_table=Identifier(self.get_transpiled_tablename(fk.other_table)),
                other_column=Identifier(self.get_transpiled_colname(fk.other_table, fk.other_column)),
            )
            sql.append(fk_sql)
        self.summary["tables"]["fks"][table.source_name] = {
            "status": "PREPARED",
            "count": len(table.src_table.foreign_keys),
        }
        return sql

    def get_index_sql(self, table: ParsedTable) -> SQL:
        sql = []
        for index in table.src_table.xindexes:
            col_sql = []
            for col in index.columns:
                if not col.name:
                    continue
                order = "ASC"
                if col.desc:
                    order = "DESC"
                col_sql.append(SQL("{name} {sort_order}").format(
                    name=Identifier(table.get_transpiled_colname(col.name)),
                    sort_order=SQL(order)),
                )
            index_sql = SQL("CREATE INDEX {index_name} ON {table_name} ({columns})").format(
                index_name=Identifier(index.name),
                table_name=Identifier(table.transpiled_name),
                columns=SQL(",").join(col_sql)
            )
            sql.append(index_sql)
        self.summary["tables"]["indexes"][table.source_name] = {
            "status": "PREPARED",
            "count": len(table.src_table.xindexes),
        }
        return sql

    def _drop_tables(self):
        if self.dry_run:
            logger.info("DRY RUN: Would drop existing tables in PostgreSQL")
            return
        with psycopg.connect(conninfo=self.pg_conninfo) as conn:
            with conn.cursor() as cur:
                for table in self.tables:
                    cur.execute(
                        SQL("DROP TABLE IF EXISTS {table_name} CASCADE;").format(
                            table_name=Identifier(table.transpiled_name)
                        )
                    )

    def get_all_tables_in_postgres(self) -> Optional[List[Any]]:
        tables_in_postgres = []
        with psycopg.connect(conninfo=self.pg_conninfo, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(SQL("""
                    SELECT
                        table_name, column_name, ordinal_position, is_nullable, data_type
                    FROM
                        information_schema.columns
                    WHERE
                        table_name
                    IN (
                        SELECT
                            table_name
                        FROM
                            information_schema.tables
                        WHERE
                            table_type='BASE TABLE'
                        AND
                            table_schema
                        NOT IN ('pg_catalog', 'information_schema')
                        )
                    ORDER BY
                        table_name, column_name, ordinal_position; """))
                tables_in_postgres = cur.fetchall()
        return tables_in_postgres

    def check_for_matching_tables(self) -> bool:
        db = Database(self.sqlite_filename)
        tables_in_postgres = self.get_all_tables_in_postgres()
        return False

    def load_schema(self, drop_existing_postgres_tables: bool = False) -> None:
        db = Database(self.sqlite_filename)
        if drop_existing_postgres_tables:
            self._drop_tables()

        self.checks_sql_by_table = self.get_check_constraints()
        for table in self.tables:
            if table.source_name in SQLITE_SYSTEM_TABLES:
                logger.debug(f"sqlite system table found: {table.source_name}")
                continue
            self.tables_sql.append(self.get_table_sql(table))
            self.fks_sql.extend(self.get_fk_sql(table))
            self.indexes_sql.extend(self.get_index_sql(table))

        if not _IGNORE_VIEWS:
            logger.debug("Ignoring views", db_filename=self.sqlite_filename)
            for view in db.views:
                logger.debug(f"DB view: {view}", view=view)
                self.summary["views"][view.name] = {
                    "status": "IGNORED",
                }
        if not _IGNORE_TRIGGERS:
            logger.debug("Ignoring triggers")
            for trigger in db.triggers:
                logger.debug(f"DB trigger: {trigger}", trigger=trigger)
                self.summary["triggers"][trigger.name] = {
                    "status": "IGNORED",
                }

    async def create_index(self, index_sql: str) -> None:
        if self.dry_run:
            logger.info(f"DRY RUN: Would create index: {index_sql.as_string(None)}")
            return
        async with await psycopg.AsyncConnection.connect(conninfo=self.pg_conninfo) as conn:
            async with conn.cursor() as pg_cur:
                index_str = index_sql.as_string(conn)
                logger.debug(f"Creating index with: {index_str}")
                await pg_cur.execute(index_sql)
                logger.debug(f"Finished creating index with: {index_str}")

    async def write_table_data(self, table: ParsedTable) -> None:
        if self.dry_run:
            logger.info(f"DRY RUN: Would load data into {table.transpiled_name}")
            return

        sl_conn = sqlite3.connect(self.sqlite_filename)
        sl_cur = sl_conn.cursor()
        logger.info(f"Loading data into {table.transpiled_name}")
        sl_cur.execute(f'SELECT * FROM "{table.source_name}"')
        nullable_column_indexes = []
        for idx, c in enumerate(table.columns):
            if not c.src_column.notnull:
                nullable_column_indexes.append(idx)

        async with await psycopg.AsyncConnection.connect(conninfo=self.pg_conninfo) as conn:
            async with conn.cursor() as pg_cur:
                async with pg_cur.copy(f'COPY "{table.transpiled_name}" FROM STDIN') as copy:
                    rows_copied = 0
                    for row in sl_cur:
                        row = list(row)
                        # Decode BLOB to UTF-8 string
                        for i, val in enumerate(row):
                            if isinstance(val, bytes):
                                try:
                                    row[i] = val.decode('utf-8')
                                except UnicodeDecodeError:
                                    pass
                        # Apply type transformers and null handling
                        for idx, c in enumerate(table.columns):
                            if c.src_column.type in self.transformers:
                                row[idx] = self.transformers[c.src_column.type](
                                    row[idx], not c.src_column.notnull
                                )
                            if not c.src_column.notnull:
                                if row[idx] != 0 and not row[idx]:
                                    row[idx] = None
                        await copy.write_row(row)
                        rows_copied += 1
                        if rows_copied % 1000 == 0:
                            self.summary["tables"]["data"][table.source_name]["status"] = (
                                f"LOADED {rows_copied}"
                            )
                    self.summary["tables"]["data"][table.source_name]["status"] = (
                        f"LOADED {rows_copied}"
                    )
                logger.info(f"Finished loading {rows_copied} rows of data into {table.transpiled_name}")
        sl_conn.close()

    def load_data_to_postgres(self):
        if self.dry_run:
            logger.info("DRY RUN: Would load data into PostgreSQL")
            return

        db = Database(self.sqlite_filename)
        sl_conn = sqlite3.connect(self.sqlite_filename)
        sl_cur = sl_conn.cursor()
        for table in db.tables:
            sl_cur.execute(f'SELECT count(*) FROM "{table.name}"')
            self.summary["tables"]["data"][table.name] = {
                "row_count": sl_cur.fetchone()[0],
                "status": "PREPARED",
            }
        sl_conn.close()

        async def load_all_data():
            await self.gather_with_concurrency(
                self.max_import_concurrency,
                *[
                    self.write_table_data(table)
                    for table in self.tables
                    if table.source_name not in SQLITE_SYSTEM_TABLES
                ],
            )
        load_results = asyncio.run(load_all_data())

        # ---- Convert boolean-semantic numeric columns to actual boolean ----
        self._convert_boolean_columns()

        # ---- Convert JSON-text columns to JSONB ----
        self._convert_json_columns()

        # ---- Fix auto-increment primary key sequences ----
        self._fix_auto_increment_sequences()

        if self.show_sample_data:
            for table in self.tables:
                with psycopg.connect(conninfo=self.pg_conninfo) as conn:
                    with conn.cursor() as cur:
                        cur.execute(f'SELECT * from "{table.transpiled_name}" LIMIT 10')
                        logger.debug(f"Data in {table.transpiled_name}")
                        logger.debug(cur.fetchall())

    def _convert_boolean_columns(self) -> None:
        """Convert numeric columns with boolean semantics to actual PostgreSQL boolean type."""
        if self.skip_boolean_conversion:
            logger.info("Skipping boolean column conversion")
            return

        with psycopg.connect(conninfo=self.pg_conninfo) as conn:
            with conn.cursor() as cur:
                # Step 1: Query all numeric/integer columns from information_schema
                cur.execute("""
                    SELECT table_name, column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                    AND data_type IN ('numeric', 'integer', 'smallint', 'bigint', 'real', 'double precision')
                    ORDER BY table_name, column_name
                """)
                all_numeric_cols = cur.fetchall()

                cols_to_convert = []
                for table_name, col_name, data_type, is_nullable in all_numeric_cols:
                    if self._is_boolean_column(table_name, col_name, data_type):
                        cols_to_convert.append((table_name, col_name))

                if not cols_to_convert:
                    logger.info("No boolean columns to convert")
                    return

                logger.info(f"Converting {len(cols_to_convert)} boolean columns: {cols_to_convert}")

                for table_name, col_name in cols_to_convert:
                    try:
                        # Build a USING clause that maps numeric to boolean:
                        # 1 (or any non-zero) -> true, 0 (or NULL and column is nullable) -> false
                        quoted_table = Identifier(table_name)
                        quoted_col = Identifier(col_name)

                        # First, update any values that aren't 0 or 1 to be valid booleans
                        cur.execute(
                            SQL("UPDATE {table} SET {col} = 1 WHERE {col} IS NOT NULL AND {col} NOT IN (0, 1)").format(
                                table=quoted_table, col=quoted_col
                            )
                        )

                        # Drop default before type change
                        try:
                            cur.execute(
                                SQL("ALTER TABLE {table} ALTER COLUMN {col} DROP DEFAULT").format(
                                    table=quoted_table, col=quoted_col
                                )
                            )
                        except Exception:
                            pass  # No default to drop

                        # Convert type: numeric::integer::boolean
                        sql_str = (
                            f'ALTER TABLE "{table_name}" '
                            f'ALTER COLUMN "{col_name}" TYPE boolean '
                            f'USING ("{col_name}"::integer::boolean)'
                        )
                        cur.execute(sql_str)

                        # Set correct default value for this specific column
                        default_sql = SQL("false")
                        if (table_name in BOOLEAN_COLUMN_DEFAULTS
                                and col_name in BOOLEAN_COLUMN_DEFAULTS[table_name]):
                            val = BOOLEAN_COLUMN_DEFAULTS[table_name][col_name]
                            default_sql = SQL(val)
                        cur.execute(
                            SQL("ALTER TABLE {table} ALTER COLUMN {col} SET DEFAULT {default}").format(
                                table=quoted_table, col=quoted_col, default=default_sql
                            )
                        )

                        logger.info(f"Converted {table_name}.{col_name} to boolean")
                    except Exception as e:
                        logger.warning(f"Failed to convert {table_name}.{col_name} to boolean: {e}")

    def _convert_json_columns(self) -> None:
        """Convert TEXT columns that store JSON to JSONB type in PostgreSQL.

        Each column conversion runs in its own transaction to prevent
        a single failure from cascading across all subsequent conversions."""
        if self.skip_json_conversion:
            logger.info("Skipping JSON column conversion")
            return

        for table in self.tables:
            table_name = table.transpiled_name
            source_name = table.source_name

            if source_name not in self.json_columns:
                continue

            json_cols = self.json_columns[source_name]
            for col_name in json_cols:
                transpiled_col = table.get_transpiled_colname(col_name)
                try:
                    with psycopg.connect(conninfo=self.pg_conninfo) as conn:
                        with conn.cursor() as cur:
                            # Check current type
                            cur.execute("""
                                SELECT data_type FROM information_schema.columns
                                WHERE table_name = %s AND column_name = %s
                            """, (table_name, transpiled_col))
                            row = cur.fetchone()
                            if not row:
                                logger.debug(
                                    f"Column {table_name}.{transpiled_col} not found, skipping"
                                )
                                continue

                            current_type = row[0]
                            # Already jsonb — skip
                            if current_type == 'jsonb':
                                logger.debug(
                                    f"Column {table_name}.{transpiled_col} is already jsonb"
                                )
                                continue
                            # Already json — only ALTER TYPE to jsonb (no data conversion needed)
                            if current_type == 'json':
                                cur.execute(
                                    SQL("ALTER TABLE {table} ALTER COLUMN {col} TYPE jsonb").format(
                                        table=Identifier(table_name),
                                        col=Identifier(transpiled_col),
                                    )
                                )
                                logger.info(
                                    f"Changed {table_name}.{transpiled_col} from json to jsonb"
                                )
                                continue

                            # For TEXT/varchar columns: count non-empty values
                            cur.execute(
                                SQL("""
                                    SELECT COUNT(*) FROM {table}
                                    WHERE {col} IS NOT NULL
                                    AND {col}::text != ''
                                """).format(
                                    table=Identifier(table_name),
                                    col=Identifier(transpiled_col),
                                )
                            )
                            non_null_count = cur.fetchone()[0]

                            # Convert, handling empty strings as NULL
                            cur.execute(
                                SQL("""
                                    ALTER TABLE {table}
                                    ALTER COLUMN {col} TYPE jsonb
                                    USING (
                                        CASE
                                            WHEN {col} IS NULL OR {col}::text = '' THEN NULL
                                            ELSE {col}::jsonb
                                        END
                                    )
                                """).format(
                                    table=Identifier(table_name),
                                    col=Identifier(transpiled_col),
                                )
                            )
                            logger.info(
                                f"Converted {table_name}.{transpiled_col} "
                                f"from {current_type} to jsonb"
                            )
                except Exception as e:
                    logger.warning(
                        f"Failed to convert {table_name}.{col_name} to jsonb: {e}. "
                        f"The column will remain as {current_type}."
                    )

    def _fix_auto_increment_sequences(self) -> None:
        """Fix auto-increment primary key sequences for all tables with an 'id' column."""
        with psycopg.connect(conninfo=self.pg_conninfo) as conn:
            with conn.cursor() as cur:
                for table in self.tables:
                    table_name = table.transpiled_name
                    pks = table.src_table.pks

                    # Handle single-column integer primary keys that look like auto-increment IDs
                    if len(pks) == 1 and pks[0] == 'id':
                        self._fix_sequence_for_table(cur, table_name)
                    # Also handle other auto-increment tables
                    elif len(pks) == 1:
                        # Check if the column type is integer and could be auto-increment
                        cur.execute("""
                            SELECT column_name, data_type, column_default
                            FROM information_schema.columns
                            WHERE table_name = %s AND column_name = %s
                        """, (table_name, pks[0]))
                        row = cur.fetchone()
                        if row and row[1] in ('integer', 'bigint') and (row[2] is None or 'nextval' not in str(row[2])):
                            self._fix_sequence_for_table(cur, table_name, pk_col=pks[0])

    def _fix_sequence_for_table(self, cur, table_name: str, pk_col: str = 'id') -> None:
        """Create a sequence and set it as default for the given table's primary key column."""
        try:
            # Check if column already has a sequence
            cur.execute("""
                SELECT column_name, data_type, column_default
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s
            """, (table_name, pk_col))
            row = cur.fetchone()

            if not row:
                return

            if row[1] not in ('integer', 'bigint'):
                return

            default = row[2]
            if default and 'nextval' in str(default):
                logger.debug(f"Column {table_name}.{pk_col} already has a sequence")
                return

            seq_name = f"{table_name}_{pk_col}_seq"

            # Create sequence if not exists
            cur.execute(SQL("CREATE SEQUENCE IF NOT EXISTS {}").format(Identifier(seq_name)))

            # Get current max value and set sequence position
            cur.execute(
                SQL("SELECT COALESCE(MAX({}), 0) FROM {}").format(
                    Identifier(pk_col), Identifier(table_name)
                )
            )
            max_id = cur.fetchone()[0]
            cur.execute(SQL("SELECT setval(%s, %s, true)"), (seq_name, max_id + 1))

            # Set default to use the sequence
            cur.execute(
                SQL("ALTER TABLE {} ALTER COLUMN {} SET DEFAULT nextval('{}')").format(
                    Identifier(table_name), Identifier(pk_col), Identifier(seq_name)
                )
            )

            # Ensure NOT NULL
            cur.execute(
                SQL("ALTER TABLE {} ALTER COLUMN {} SET NOT NULL").format(
                    Identifier(table_name), Identifier(pk_col)
                )
            )

            logger.info(f"Added sequence {seq_name} for {table_name}.{pk_col} (max={max_id})")
        except Exception as e:
            logger.warning(f"Failed to add sequence for {table_name}.{pk_col}: {e}")

    def get_summary(self) -> Dict[str, Any]:
        return self.summary

    def get_check_constraints(self):
        sl_conn = sqlite3.connect(self.sqlite_filename)
        sl_cur = sl_conn.cursor()
        sl_cur.execute('select name, sql from sqlite_master where type="table"')
        checks = {}
        for row in sl_cur:
            checks[row[0]] = []
            transpile = ""
            for line in row[1].split('\n'):
                if "CHECK" in line:
                    start = line.index("(")
                    end = line.rindex(")")
                    sql_expr = line[start + 1:end]
                    clean_check_str = "    " + line.strip().rstrip(',')
                    checks[row[0]].append(SQL(clean_check_str))
                else:
                    transpile = transpile + "\n" + line
            transpile = transpile.replace('[', '"').replace(']', '"')
            transpile = transpile.replace('`', '"')
        sl_conn.close()
        return checks

    def populate_postgres(self) -> None:
        if self.dry_run:
            logger.info("DRY RUN: Would create tables, load data, indexes, and foreign keys")
            for create_sql in self.tables_sql:
                logger.info(f"DRY RUN: Would execute: {create_sql.as_string(None)}")
            return

        with psycopg.connect(conninfo=self.pg_conninfo) as conn:
            with conn.cursor() as cur:
                for create_sql in self.tables_sql:
                    logger.debug("Running SQL:")
                    sql_str = create_sql.as_string(conn)
                    # Fix SQLite-style default values for PostgreSQL compatibility
                    sql_str = self._fix_defaults_for_postgres(sql_str)
                    create_sql = SQL(sql_str)
                    cur.execute(create_sql)
            for column in self.summary["tables"]["columns"].values():
                column["status"] = "CREATED"
            for pk in self.summary["tables"]["pks"].values():
                pk["status"] = "CREATED"

        self.load_data_to_postgres()

        async def create_all_indexes():
            await self.gather_with_concurrency(
                self.max_import_concurrency,
                *[self.create_index(index) for index in self.indexes_sql]
            )
            for table in self.summary["tables"]["indexes"]:
                self.summary["tables"]["indexes"][table]["status"] = "CREATED"

        asyncio.run(create_all_indexes())

        with psycopg.connect(conninfo=self.pg_conninfo) as conn:
            with conn.cursor() as cur:
                for fk in self.fks_sql:
                    logger.debug("Running SQL:")
                    logger.debug(fk.as_string(conn))
                    cur.execute(fk)
                for table in self.summary["tables"]["fks"]:
                    self.summary["tables"]["fks"][table]["status"] = "CREATED"

    def _fix_defaults_for_postgres(self, sql_str: str) -> str:
        """Fix SQLite-style defaults for PostgreSQL compatibility.

        Handles:
        - DEFAULT "value" -> DEFAULT 'value' (double quotes to single quotes)
        - DEFAULT false -> DEFAULT 0 (when table is not using native boolean)
        - DEFAULT true -> DEFAULT 1
        - DEFAULT 'false' -> DEFAULT 0 (in numeric context)
        - DEFAULT 'true' -> DEFAULT 1 (in numeric context)
        """
        # Fix double-quoted defaults to single quotes
        sql_str = re.sub(r'DEFAULT "([^"]*)"', r"DEFAULT '\1'", sql_str)

        # Fix boolean defaults to numeric for SQLite-compatible tables
        # These are applied before the boolean conversion step
        sql_str = re.sub(r'\bDEFAULT false\b', 'DEFAULT 0', sql_str, flags=re.IGNORECASE)
        sql_str = re.sub(r'\bDEFAULT true\b', 'DEFAULT 1', sql_str, flags=re.IGNORECASE)

        return sql_str


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert a SQLite database to PostgreSQL. "
                    "Includes special handling for the new-api project schema."
    )
    parser.add_argument(
        "-f", "--sqlite_filename", type=str, required=True,
        help="SQLite database file to import"
    )
    parser.add_argument(
        "-p", "--postgres_connect_url", type=str, required=True,
        help="PostgreSQL connection URL"
    )
    parser.add_argument(
        "--max_import_concurrency", type=int, default=10,
        help="Number of concurrent data import coroutines"
    )
    parser.add_argument(
        "-d", "--debug", type=bool, default=False,
        help="Set log level to DEBUG"
    )
    parser.add_argument(
        "--show_sample_data", type=bool, default=False,
        help="Show up to 10 rows of imported data per table"
    )
    parser.add_argument(
        "--drop_tables", type=bool, default=False,
        help="Drop existing tables in PostgreSQL before import"
    )
    parser.add_argument(
        "--drop_everything", type=bool, default=False,
        help="Drop everything in the target database before import"
    )
    parser.add_argument(
        "--drop_tables_after_import", type=bool, default=False,
        help="Drop all tables after import (useful for testing)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=False,
        help="Print what would be done without executing"
    )
    parser.add_argument(
        "--skip-boolean-conversion", action="store_true", default=False,
        help="Skip automatic boolean column conversion"
    )
    parser.add_argument(
        "--skip-json-conversion", action="store_true", default=False,
        help="Skip automatic JSON/JSONB column conversion"
    )
    parser.add_argument(
        "--extra-boolean-columns", type=str, default=None,
        help="Additional boolean columns in format: table.col,table.col2"
    )
    parser.add_argument(
        "--extra-json-columns", type=str, default=None,
        help="Additional JSON columns in format: table.col,table.col2"
    )
    args = parser.parse_args()

    if args.debug:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG)
        )
    else:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(logging.INFO)
        )

    sqlite_filename = args.sqlite_filename
    pg_conninfo = args.postgres_connect_url

    # Build boolean column mapping: start with new-api defaults, add extras
    boolean_columns = {k: set(v) for k, v in NEW_API_BOOLEAN_COLUMNS.items()}
    if args.extra_boolean_columns:
        for entry in args.extra_boolean_columns.split(","):
            entry = entry.strip()
            if "." in entry:
                table, col = entry.split(".", 1)
                if table not in boolean_columns:
                    boolean_columns[table] = set()
                boolean_columns[table].add(col)

    # Build JSON column mapping: start with new-api defaults, add extras
    json_columns = {k: set(v) for k, v in NEW_API_JSON_COLUMNS.items()}
    if args.extra_json_columns:
        for entry in args.extra_json_columns.split(","):
            entry = entry.strip()
            if "." in entry:
                table, col = entry.split(".", 1)
                if table not in json_columns:
                    json_columns[table] = set()
                json_columns[table].add(col)

    loader = PGSqlite(
        sqlite_filename,
        pg_conninfo,
        show_sample_data=args.show_sample_data,
        max_import_concurrency=args.max_import_concurrency,
        dry_run=args.dry_run,
        boolean_columns=boolean_columns,
        json_columns=json_columns,
        skip_boolean_conversion=args.skip_boolean_conversion,
        skip_json_conversion=args.skip_json_conversion,
    )
    loader.load_schema(drop_existing_postgres_tables=args.drop_tables)

    if args.dry_run:
        logger.info("=== DRY RUN: No changes will be made to PostgreSQL ===")
        loader.populate_postgres()
        logger.info("=== DRY RUN complete ===")
    else:
        loader.populate_postgres()

    logger.debug(json.dumps(loader.get_summary(), indent=2))

    if args.drop_tables_after_import:
        loader._drop_tables()
