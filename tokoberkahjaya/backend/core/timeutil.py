from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from database import SQLALCHEMY_DATABASE_URL

DEFAULT_TZ = "Asia/Jakarta"
_IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")


def get_zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TZ)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo(DEFAULT_TZ)


def as_utc(value: datetime) -> datetime:
    """Timestamps from SQLite come back naive (stored as UTC); normalise to aware UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def to_db(value: datetime) -> datetime:
    """Convert an aware datetime into the form used for comparisons in the active database."""
    utc_value = as_utc(value)
    return utc_value.replace(tzinfo=None) if _IS_SQLITE else utc_value


def local_date(value: datetime, zone: ZoneInfo) -> date:
    return as_utc(value).astimezone(zone).date()


def local_day_start(day: date, zone: ZoneInfo) -> datetime:
    return datetime.combine(day, time.min, tzinfo=zone)


def local_range_to_db(start: date | None, end: date | None, zone: ZoneInfo) -> tuple[datetime | None, datetime | None]:
    """Inclusive local date range -> half-open [start, end) bounds in database form."""
    lower = to_db(local_day_start(start, zone)) if start else None
    upper = to_db(local_day_start(end + timedelta(days=1), zone)) if end else None
    return lower, upper


def today(zone: ZoneInfo) -> date:
    return datetime.now(zone).date()
