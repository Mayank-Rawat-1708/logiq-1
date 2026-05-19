import re
import json
from datetime import datetime
from typing import Optional, Tuple
from dateutil import parser as dateutil_parser
from app.models.log_entry import LogLevel


LEVEL_MAP = {
    "debug": LogLevel.DEBUG,
    "info": LogLevel.INFO,
    "warn": LogLevel.WARN,
    "warning": LogLevel.WARN,
    "error": LogLevel.ERROR,
    "err": LogLevel.ERROR,
    "critical": LogLevel.CRITICAL,
    "crit": LogLevel.CRITICAL,
    "fatal": LogLevel.CRITICAL,
    "notice": LogLevel.INFO,
    "verbose": LogLevel.DEBUG,
    "trace": LogLevel.DEBUG,
}

# Nginx/Apache combined log pattern
NGINX_PATTERN = re.compile(
    r'(?P<ip>[\d.]+) - (?P<user>\S+) \[(?P<time>[^\]]+)\] "(?P<request>[^"]*)" (?P<status>\d+) (?P<bytes>\d+)'
)

# Python logging: 2024-01-15 10:23:45,123 ERROR service.name Message here
PYTHON_LOG_PATTERN = re.compile(
    r'(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[,.\d]*)\s+(?P<level>DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\s+(?P<logger>[\w.]+)?\s*[-:]?\s*(?P<message>.*)'
)

# Generic: [TIMESTAMP] LEVEL: message or TIMESTAMP [LEVEL] message
GENERIC_PATTERN = re.compile(
    r'(?P<timestamp>\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s*\[?(?P<level>DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL|NOTICE|TRACE|VERBOSE)\]?\s*:?\s*(?P<service>\[[\w./-]+\])?\s*(?P<message>.*)',
    re.IGNORECASE
)

# Syslog: Jan 15 10:23:45 hostname service[pid]: message
SYSLOG_PATTERN = re.compile(
    r'(?P<timestamp>(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(?P<host>\S+)\s+(?P<service>\S+?)(?:\[(?P<pid>\d+)\])?\s*:\s*(?P<message>.*)'
)


def _normalize_level(level_str: Optional[str]) -> LogLevel:
    if not level_str:
        return LogLevel.UNKNOWN
    return LEVEL_MAP.get(level_str.lower(), LogLevel.UNKNOWN)


def _parse_timestamp(ts_str: str) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        return dateutil_parser.parse(ts_str, fuzzy=True)
    except Exception:
        return None


def _infer_level_from_message(message: str) -> LogLevel:
    lower = message.lower()
    if any(w in lower for w in ["critical", "fatal", "panic"]):
        return LogLevel.CRITICAL
    if any(w in lower for w in ["error", "err ", "exception", "traceback", "failed"]):
        return LogLevel.ERROR
    if any(w in lower for w in ["warn", "warning"]):
        return LogLevel.WARN
    if any(w in lower for w in ["debug", "verbose", "trace"]):
        return LogLevel.DEBUG
    if any(w in lower for w in ["info", "notice", "starting", "started", "listening"]):
        return LogLevel.INFO
    return LogLevel.UNKNOWN


def parse_log_line(raw_line: str, line_number: int) -> dict:
    """
    Attempt to parse a single log line into structured components.
    Returns dict with: timestamp, level, service, message
    """
    line = raw_line.strip()
    if not line:
        return {
            "line_number": line_number,
            "raw_text": raw_line,
            "timestamp": None,
            "level": LogLevel.UNKNOWN,
            "service": None,
            "message": raw_line,
        }

    # Try JSON first (Node.js/Winston, structured logging)
    if line.startswith("{"):
        try:
            obj = json.loads(line)
            ts = (
                obj.get("timestamp") or obj.get("time") or obj.get("ts") or
                obj.get("@timestamp") or obj.get("datetime")
            )
            level_raw = (
                obj.get("level") or obj.get("severity") or obj.get("lvl") or
                obj.get("log_level") or ""
            )
            service = (
                obj.get("service") or obj.get("name") or obj.get("logger") or
                obj.get("app") or None
            )
            message = (
                obj.get("message") or obj.get("msg") or obj.get("error") or
                obj.get("text") or str(obj)
            )
            return {
                "line_number": line_number,
                "raw_text": raw_line,
                "timestamp": _parse_timestamp(str(ts)) if ts else None,
                "level": _normalize_level(str(level_raw)),
                "service": str(service) if service else None,
                "message": str(message),
            }
        except json.JSONDecodeError:
            pass

    # Try Nginx/Apache access log
    nginx_match = NGINX_PATTERN.match(line)
    if nginx_match:
        g = nginx_match.groupdict()
        request = g.get("request", "")
        status_code = int(g.get("status", 0))
        level = LogLevel.ERROR if status_code >= 500 else (LogLevel.WARN if status_code >= 400 else LogLevel.INFO)
        return {
            "line_number": line_number,
            "raw_text": raw_line,
            "timestamp": _parse_timestamp(g.get("time", "")),
            "level": level,
            "service": "nginx",
            "message": f'{g.get("ip")} "{request}" {status_code} {g.get("bytes")}B',
        }

    # Try Python logging format
    py_match = PYTHON_LOG_PATTERN.match(line)
    if py_match:
        g = py_match.groupdict()
        return {
            "line_number": line_number,
            "raw_text": raw_line,
            "timestamp": _parse_timestamp(g.get("timestamp", "")),
            "level": _normalize_level(g.get("level")),
            "service": g.get("logger"),
            "message": g.get("message", "").strip(),
        }

    # Try syslog format
    syslog_match = SYSLOG_PATTERN.match(line)
    if syslog_match:
        g = syslog_match.groupdict()
        msg = g.get("message", "")
        return {
            "line_number": line_number,
            "raw_text": raw_line,
            "timestamp": _parse_timestamp(g.get("timestamp", "")),
            "level": _infer_level_from_message(msg),
            "service": g.get("service"),
            "message": msg,
        }

    # Try generic pattern
    generic_match = GENERIC_PATTERN.match(line)
    if generic_match:
        g = generic_match.groupdict()
        service = g.get("service", "")
        if service:
            service = service.strip("[]")
        return {
            "line_number": line_number,
            "raw_text": raw_line,
            "timestamp": _parse_timestamp(g.get("timestamp", "")),
            "level": _normalize_level(g.get("level")),
            "service": service or None,
            "message": g.get("message", "").strip(),
        }

    # Fallback: plain text
    inferred_level = _infer_level_from_message(line)
    return {
        "line_number": line_number,
        "raw_text": raw_line,
        "timestamp": None,
        "level": inferred_level,
        "service": None,
        "message": line,
    }


def parse_log_text(raw_text: str) -> list[dict]:
    """Parse full log text into list of structured entries."""
    lines = raw_text.splitlines()
    results = []
    for i, line in enumerate(lines, start=1):
        if line.strip():
            results.append(parse_log_line(line, i))
    return results
