class PipelineError(Exception):
    """Error base del pipeline."""


class SourceUnavailable(PipelineError):  # noqa: N818
    """La fuente no respondió o respondió con error tras agotar los reintentos."""

    def __init__(self, source: str, reason: str):
        super().__init__(f"{source}: {reason}")
        self.source = source
        self.reason = reason


class SourceFormatError(PipelineError):
    """La fuente respondió, pero su contenido no tiene el formato esperado."""

    def __init__(self, source: str, reason: str):
        super().__init__(f"{source}: {reason}")
        self.source = source
        self.reason = reason
