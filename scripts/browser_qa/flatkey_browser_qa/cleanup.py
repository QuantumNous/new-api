from dataclasses import dataclass

from .api import ApiError, MalformedApiResponse


@dataclass(frozen=True)
class CleanupResult:
    deleted_token_count: int
    account_deleted: bool
    login_rejected_after_delete: bool
    cleanup_failed: bool
    reason: str


class CleanupRunner:
    def __init__(self, client, *, page_size=100, max_attempts=3, max_pages=1000):
        if not 1 <= page_size <= 100:
            raise ValueError("page_size must be between 1 and 100")
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        if not isinstance(max_pages, int) or isinstance(max_pages, bool) or max_pages < 1:
            raise ValueError("max_pages must be a positive integer")
        self.client = client
        self.page_size = page_size
        self.max_attempts = max_attempts
        self.max_pages = max_pages

    def run(self, identity):
        deleted_ids = set()
        account_deleted = False
        try:
            login = self.client.login(identity.username, identity.password)
            if login.auth_rejected:
                self.client.clear_cookies()
                return CleanupResult(0, False, True, False, "account already absent")

            for _ in range(self.max_attempts):
                ids = self._collect_all_token_ids()
                if not ids:
                    break
                for token_id in ids:
                    if self.client.delete_token(token_id):
                        deleted_ids.add(token_id)
            else:
                return self._failed(len(deleted_ids), account_deleted, "token cleanup did not converge")

            remaining = self._collect_all_token_ids()
            if remaining:
                return self._failed(len(deleted_ids), account_deleted, "token cleanup left unverified tokens")

            try:
                self.client.delete_self()
            except ApiError:
                if self._login_is_rejected(identity):
                    return CleanupResult(len(deleted_ids), True, True, False, "cleanup verified after uncertain account delete")
                return self._failed(len(deleted_ids), account_deleted, "account cleanup failed")
            account_deleted = True
            if not self._login_is_rejected(identity):
                return self._failed(len(deleted_ids), account_deleted, "account deletion was not verified by rejected login")
            return CleanupResult(len(deleted_ids), True, True, False, "cleanup verified")
        except MalformedApiResponse:
            self.client.clear_cookies()
            return self._failed(len(deleted_ids), account_deleted, "malformed pagination or api response")
        except ApiError as exc:
            self.client.clear_cookies()
            detail = "account cleanup failed" if account_deleted is False else "post-delete verification failed"
            if "token" in str(exc).lower() or exc.status == 404:
                detail = "token cleanup failed"
            return self._failed(len(deleted_ids), account_deleted, detail)

    def _collect_all_token_ids(self):
        seen_ids = set()
        page = 1
        while True:
            if page > self.max_pages:
                raise MalformedApiResponse("malformed token pagination")
            ids, total = self.client.list_tokens(page=page, size=self.page_size)
            if not ids and total != 0:
                raise MalformedApiResponse("malformed token pagination")
            previous_count = len(seen_ids)
            for token_id in ids:
                seen_ids.add(token_id)
            saw_new_ids = len(seen_ids) > previous_count
            if not ids:
                break
            if page * self.page_size >= total:
                break
            if not saw_new_ids:
                raise MalformedApiResponse("malformed token pagination")
            page += 1
        return seen_ids

    def _login_is_rejected(self, identity):
        self.client.clear_cookies()
        try:
            return self.client.login(identity.username, identity.password).auth_rejected
        except ApiError:
            return False
        finally:
            self.client.clear_cookies()

    def _failed(self, deleted_token_count, account_deleted, reason):
        self.client.clear_cookies()
        return CleanupResult(
            deleted_token_count=deleted_token_count,
            account_deleted=account_deleted,
            login_rejected_after_delete=False,
            cleanup_failed=True,
            reason=reason,
        )
