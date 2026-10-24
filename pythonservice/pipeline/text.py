import re
import unicodedata

_SMALL_WORDS = {"de", "del", "la", "las", "los", "el", "y", "e", "o", "en", "a", "para", "con"}
# Siglas que el Ministerio escribe como palabra y que deben verse en mayúsculas.
_ACRONYMS = {"uc", "ucn", "pucv", "cft", "aiep", "iacc", "ipg", "icce"}


def collapse_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def strip_accents(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def name_key(text: str) -> str:
    """Clave de comparación: minúsculas, sin tildes ni puntuación, espacios simples."""
    t = strip_accents(text).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return collapse_spaces(t)


def _cap_word(word: str, first: bool, keep_acronyms: bool) -> str:
    if "'" in word:  # O'Higgins
        return "'".join(p[:1].upper() + p[1:].lower() for p in word.split("'"))
    if "-" in word:  # Bío-Bío
        return "-".join(_cap_word(p, True, keep_acronyms) for p in word.split("-"))
    if keep_acronyms and word.isupper() and len(word) <= 4 and word.lower() not in _SMALL_WORDS:
        return word  # siglas (UC, UTEM)
    low = word.lower()
    if low in _ACRONYMS:
        return low.upper()
    if not first and low in _SMALL_WORDS:
        return low
    return low[:1].upper() + low[1:]


def display_name(raw: str) -> str:
    """'UNIVERSIDAD DEL BÍO-BÍO' → 'Universidad del Bío-Bío'."""
    clean = collapse_spaces(raw)
    keep = not clean.isupper()  # en un texto TODO en mayúsculas no hay siglas que respetar
    return " ".join(_cap_word(w, i == 0, keep) for i, w in enumerate(clean.split(" ")))


def slug(text: str) -> str:
    return name_key(text).replace(" ", "-")
