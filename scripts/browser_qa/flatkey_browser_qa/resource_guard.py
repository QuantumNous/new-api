class ResourceDriftError(RuntimeError):
    pass


class CheckpointResourceGuard:
    def __init__(self, client_factory, *, page_size=100, max_pages=1000):
        if not callable(client_factory):
            raise TypeError("client_factory must be callable")
        if (
            not isinstance(page_size, int)
            or isinstance(page_size, bool)
            or not 1 <= page_size <= 100
        ):
            raise ValueError("page_size must be between 1 and 100")
        if not isinstance(max_pages, int) or isinstance(max_pages, bool) or max_pages < 1:
            raise ValueError("max_pages must be a positive integer")
        self.client_factory = client_factory
        self.page_size = page_size
        self.max_pages = max_pages
        self._baseline = None

    @property
    def checkpoint_captured(self):
        return self._baseline is not None

    def capture(self, identity):
        baseline = self._read_ids(identity)
        self._baseline = frozenset(baseline)

    def verify(self, identity):
        if self._baseline is None:
            raise ResourceDriftError("checkpoint resource baseline missing")
        current = frozenset(self._read_ids(identity))
        if current != self._baseline:
            raise ResourceDriftError("exploration resource drift detected")

    def _read_ids(self, identity):
        client = self.client_factory()
        try:
            login = client.login(identity.username, identity.password)
            if login.auth_rejected:
                raise ResourceDriftError("checkpoint account unavailable")
            seen = set()
            for page in range(1, self.max_pages + 1):
                ids, total = client.list_tokens(page=page, size=self.page_size)
                previous_count = len(seen)
                seen.update(ids)
                if len(seen) > total:
                    raise ResourceDriftError("checkpoint token pagination invalid")
                if len(seen) == total:
                    return seen
                if not ids or len(seen) == previous_count:
                    raise ResourceDriftError("checkpoint token pagination invalid")
            raise ResourceDriftError("checkpoint token pagination exceeded limit")
        finally:
            client.clear_cookies()
