# Пользовательский PAT для GetAPI

- **Status:** Draft
- **Version:** v1.3
- **Owners:** new-api — единственный issuer и источник состояния; getapi-backend — защищённая копия PAT.
- **Source files:** `controller/user.go`, `model/user.go`, `router/api-router.go`, `controller/access_token.go`, `docs/openapi/api.en.json`, `docs/openapi/api.json`.
- **Related ADRs:** нет.
- **Связанный контракт:** [интеграция getapi-backend](../../../getapi-backend/docs/specs/newapi-pat-integration.md).

Пользователь разрешил PAT-only реализацию через два PR и 2026-09-08 выбрал существующий create → local persist workflow без durable provisioning intent. Draft описывает целевой контракт, а не подтверждённую готовность реализации или разрешение deployment.

## Scope

Ключевые слова MUST, MUST NOT, SHOULD, SHOULD NOT, MAY, REQUIRED и OPTIONAL интерпретируются по RFC 2119 и BCP 14: MUST / MUST NOT — обязательное требование / запрет; SHOULD / SHOULD NOT — рекомендация / нежелательный вариант с обоснованием отклонения; MAY — допустимый выбор; REQUIRED эквивалентно MUST, OPTIONAL эквивалентно MAY.

### Согласованные инварианты

- PAT без TTL используется для пользовательских management-вызовов GetAPI; это не relay key и не общая dashboard session.
- Отдельный custom create создаёт обычного пользователя и первоначальный PAT.
- NewAPI единолично выпускает PAT для явно GetAPI-managed аккаунтов.
- Block из любой из двух админок отзывает PAT; фактический unblock выпускает новый; повтор enable активного пользователя не вращает его.
- Backend получает текущий секрет через ограниченный read-current, сохраняет зашифрованно и не передаёт frontend.
- Синхронизация ленивая, без обязательных webhook, polling, истории секретов или монотонных версий.
- Стандартный create возвращается к точному upstream только после переключения всех consumers.
- Consumer создаёт external identity на попытку без pre-create intent table; удаление newly-created provider user допускается только как безопасно классифицированная компенсация локального rollback. Ошибка письма после commit не является основанием удаления.

Не входят: изменение relay keys, pricing/billing, удаление admin auth, dashboard refresh, массовый автоматический перенос существующих аккаунтов и общий operation ledger.

## Current Contract — информативно

Проверенная база fork: `7ff55129233e58a098dfe7fc12efa94f744f0271`.

- PAT хранится в `users.access_token`, один на пользователя; validator не проверяет TTL (`model/user.go:95–96,1329–1342`).
- `GET`/`POST /api/user/token` генерируют и заменяют PAT, а не читают его; требуются dashboard session и одноразовый proof `access_token.generate` (`controller/access_token.go:24–48`, `middleware/secure_verification.go:39–75`). Metadata status не возвращает секрет.
- Обе админки вызывают `POST /api/user/manage`: native `web/src/features/users/api.ts:124–128`, GetAPI `src/integrations/newApi/services/new-api-user.service.ts:74–75` в соседнем backend.
- Disable/enable сходятся в `controller/user.go:1112–1119,1192` → `model/user.go:821–879`. `UpdateWithTx` сейчас читает строку без row lock и исключает `access_token`; status/PAT не меняются атомарно. Отдельные PAT helpers `model/user.go:146–176` сами по себе эту гарантию не дают.
- PAT не является session JWT: logout/session revoke/password reset не равнозначны его отзыву. Сейчас disabled запрещает использование, но enable может вернуть доступ старому PAT.
- Текущий fork create возвращает `201` и `data`; точный upstream handler в `0c76e4dae77a279e015329b7478e6f02d6b62edd:controller/user.go:969–1025` возвращает `200 {success,message}` без `data`.

## Target Migration — будущий контракт

Следующие требования будут применяться после принятия Draft. Разделы «Информативно» не задают дополнительных требований.

### 1. Владение и доступ

`integration_id` определяется сервером из доверенного backend principal. `external_account_id` — непрозрачная identity одной попытки создания; она неизменна внутри попытки и сохраняется с успешно созданным аккаунтом GetAPI, но не требует отдельной durable записи до create. Это не username и не ID человека. Binding связывает `(integration_id, external_account_id)` с одним upstream `user_id`. Managed означает наличие этой явно установленной связи, а не совпадение username.

P-01. Binding MUST быть уникальным по паре integration/external identity и по upstream user.

P-02. Custom API MUST требовать аутентифицированный включённый backend principal роли admin/root с явно назначенной capability `getapi.users.provision` для create либо `getapi.users.read-current` для read-current.

P-03. Обычная роль admin без соответствующей capability MUST NOT открывать custom API.

P-04. Custom API MUST ограничивать цели обычной ролью пользователя, строго ниже роли principal.

P-05. Lookup чужого binding MUST возвращать тот же `404 GETAPI_ACCOUNT_NOT_FOUND`, что и отсутствующего.

P-06. Capability MUST NOT заменять или ослаблять session/proof проверки стандартного `/api/user/token`.

P-07. Обычные user DTO, native admin frontend и публичный GetAPI API MUST NOT получать PAT из новых контрактов.

### 2. Только два новых маршрута

Предлагаемый wire contract; существующий `/api/user/manage` не дублируется custom state endpoint.

| Метод и путь                                             | Запрос                                                                                                                   | Успешный результат                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `POST /api/getapi/users`                                 | JSON `external_account_id`, `username`, `password`, `display_name`; header `Idempotency-Key` равен `external_account_id` | `201` при создании; `200` при совпадающем существующем binding; envelope ниже |
| `GET /api/getapi/users/{external_account_id}/credential` | Только identity в пути                                                                                                   | `200` с текущим состоянием и разрешённым текущим секретом                     |

Все четыре поля create — обязательные строки; `external_account_id` — непустая URL-safe opaque identity без секрета. Username/password/display_name проходят действующие ограничения обычного create; `display_name` допускает пустую строку в пределах этих ограничений. Role/status/PAT нельзя задавать в запросе.

Успешный envelope: `{success: true, data: {external_account_id, user_id, state, access_token}}`.

| Поле результата       | Тип                     | Значение                                          |
| --------------------- | ----------------------- | ------------------------------------------------- |
| `external_account_id` | string                  | Запрошенный binding reference                     |
| `user_id`             | positive integer        | Закреплённый upstream user                        |
| `state`               | `"active" \| "blocked"` | Наблюдаемое состояние пользователя                |
| `access_token`        | string или null         | Непустой текущий PAT для active; null для blocked |

P-08. Сервер MUST отклонять неизвестные поля и неверный `Idempotency-Key` с `400 GETAPI_INVALID_REQUEST`.

P-09. Identity и credential в успешном результате MUST соответствовать одному согласованному наблюдению binding и пользователя.

P-10. Read-current MUST возвращать только существующий текущий PAT; он MUST NOT создавать PAT или включать пользователя.

P-11. Для blocked read-current MUST возвращать `state = "blocked", access_token = null`, даже если нарушенный внешний путь оставил PAT в БД.

P-12. Для active без PAT read-current MUST возвращать `409 GETAPI_PAT_MISSING` без секрета.

P-13. Для отсутствующей цели read-current MUST возвращать `404 GETAPI_ACCOUNT_NOT_FOUND`, а не сохранённый прежний результат.

P-14. Все ответы custom API MUST иметь `Cache-Control: no-store`.

### 3. Create и восстановление после потери ответа

P-15. Первый create MUST атомарно создавать обычного активного user, binding и первоначальный PAT без TTL.

P-16. Конкурентные create одного binding MUST создавать не более одного user.

P-17. Совпадающий повтор create существующего binding MUST возвращать текущее состояние по P-09–P-13 без повторного создания, выдачи PAT или enable.

P-18. Существующий binding MUST сохранять исходные username/display_name и keyed fingerprint исходного password для сравнения create; fingerprint key MUST храниться вне этой БД.

P-19. Повтор create с отличающимися исходными полями MUST возвращать `409 GETAPI_CREATE_CONFLICT` без изменения пользователя.

P-20. Username либо upstream user, уже занятые вне этого binding, MUST давать `409 GETAPI_BINDING_CONFLICT` без автоматического присвоения аккаунта или замены его PAT.

P-21. После неоднозначного create consumer MUST использовать read-current с identity той же попытки, пока она известна; `404` MUST NOT запускать автоматический повтор create или delete.

P-22. Автоматическая delete-компенсация MUST быть разрешена только для валидированного результата `201` этого initial create при доказанном отсутствии локального commit.

P-22a. До delete consumer MUST установить исходы всех уже отправленных create этой попытки и исключить их дальнейшее выполнение; неопределённый in-flight create MUST блокировать удаление.

P-22b. Результат `200` существующего binding, read-current либо потерянный create response MUST NOT давать право автоматической delete-компенсации.

P-22c. Delete MUST адресовать только установленный upstream user ID этой попытки; после компенсации consumer MUST NOT повторять create с её identity.

P-22d. Неопределённый локальный commit либо неуспешный/неопределённый delete MUST завершать автоматическое восстановление без повторного create или delete.

Информативно: producer сохраняет идемпотентность одинакового create по существующему binding, но не хранит исторический replay удалённой операции. Без durable pre-create intent crash может оставить orphan provider user и потерянную identity; автоматическое восстановление после такого crash не гарантируется. `404`, неопределённый commit и failed delete требуют отдельного разбора. Consumer не компенсирует письмо после локального commit. Операторское удаление вне P-22 требует отдельного разрешения и установления identity/исходов; tombstones, outbox и operation ledger не вводятся.

### 4. Общая блокировка и разблокировка

P-23. Для managed user обе административные поверхности MUST использовать общую status-операцию ниже стандартного controller, сохраняя публичный request/response контракт `POST /api/user/manage`.

P-24. Каждый авторизованный block MUST атомарно обеспечивать фактическое постусловие: user disabled и текущий PAT отсутствует, включая повтор block уже disabled user.

P-25. Фактический переход blocked → active MUST атомарно включать user и выпускать новый PAT, отличный от отозванного.

P-26. Enable уже active user MUST NOT выпускать или заменять PAT, включая active без PAT.

P-27. Конкурентные status-операции одного user MUST применяться в едином порядке commit без раздельного commit статуса и PAT.

P-28. После успешного block последующая аутентификация отозванным PAT MUST отвергаться на всех instances, в том числе после unblock.

P-29. Общий hook MUST сохранять существующие проверки полномочий native manage и существующую session invalidation при смене статуса.

P-30. Автоматический lifecycle P-24–P-26 MUST применяться только к явно managed user; чужие аккаунты MUST сохранять стандартное поведение.

Информативно: запрос, авторизованный до block, может завершиться. Статус ответа — snapshot; конкурентный следующий admin action может его изменить. Поздний enable как отдельная авторизованная команда может следовать за block: строгая защита от устаревших административных намерений версией в этот контракт не входит. При ошибке после commit результат уточняется read-current, а не повторной отправкой enable. Реальные SQLite/MySQL/PostgreSQL требуют проверки сериализации, а не предположения о работоспособности row lock.

### 5. Ошибки и секреты

P-31. Custom errors MUST иметь форму `{success: false, code, message}` без PAT/password и без старого успешного результата.

| HTTP | `code`                          | Значение                                                |
| ---- | ------------------------------- | ------------------------------------------------------- |
| 400  | `GETAPI_INVALID_REQUEST`        | Нарушена структура запроса                              |
| 401  | `AUTH_UNAUTHORIZED`             | Нет действующей административной аутентификации         |
| 403  | `GETAPI_CAPABILITY_DENIED`      | Нет capability либо нарушена иерархия ролей             |
| 404  | `GETAPI_ACCOUNT_NOT_FOUND`      | Нет доступного binding/цели                             |
| 409  | `GETAPI_CREATE_CONFLICT`        | Существующий binding имеет другие исходные create-поля  |
| 409  | `GETAPI_BINDING_CONFLICT`       | Username/user уже занят несовместимо                    |
| 409  | `GETAPI_PAT_MISSING`            | Managed user активен, но PAT отсутствует                |
| 503  | `GETAPI_CREDENTIAL_UNAVAILABLE` | Нельзя достоверно прочитать или зафиксировать результат |

P-32. Проверка аутентификации/capability MUST предшествовать раскрытию существования цели и сравнению create-полей; для доступного existing binding P-19 MUST предшествовать возврату его текущего состояния.

P-33. PAT и password MUST передаваться только защищённым service-to-service транспортом, не в URL.

P-34. Логи, аудит, tracing и metrics labels MUST NOT содержать PAT, password или их обратимые представления.

P-35. Аудит MUST фиксировать principal, binding/user, действие и исход без credential material.

Информативно: read-current является новым правом повторного получения действующего секрета. Это не правило «показать один раз» и не общее право любого admin читать произвольные PAT. Конкретное назначение capabilities доверенному principal требует security acceptance.

## Compatibility — будущий rollout

C-01. Producer MUST сначала добавить custom create/read-current, общий lifecycle и соответствующий OpenAPI, сохранив текущий fork create.

C-02. Существующие accounts MUST переходить в managed только через отдельно разрешённую одноразовую процедуру проверки ownership; совпадение username MUST NOT разрешать замену foreign PAT.

C-03. Возврат стандартного create MUST следовать за проверенным cutover signup, corporate signup, invitation и create-test-user consumers.

C-04. Восстановление MUST охватывать точный delta `CreateUser` относительно `0c76e4dae77a279e015329b7478e6f02d6b62edd`: `200 {success,message}` без data, исходные validation/error statuses и insert/username-conflict behavior.

C-05. Восстановление MUST NOT откатывать весь файл, новые auth handlers или unrelated fork changes.

C-06. Стандартные OpenAPI/tests MUST соответствовать восстановленному handler; custom DTO MUST оставаться на отдельном пути.

C-07. Откат backend к старому create consumer после C-04 MUST требовать совместимого provider release, а не самостоятельного consumer rollback.

## Validation

Будущая реализация проверяется следующими сценариями:

- P-01–P-07: чужой binding, обычный user, admin без capability и запрещённая role target не получают секрет; стандартный proof не обходится.
- P-08–P-22: атомарный create; конкурентные одинаковые запросы; changed-body conflict; lost response → current; blocked/rotated user при повторе не включается; `404` не порождает повторное создание; username collision не меняет foreign PAT; `201` + доказанный local rollback допускает delete только известного ID; `200`/read-current/lost response/ambiguous commit не допускают компенсацию; in-flight create и failed delete останавливают автоматизацию; compensated identity не переисполняется.
- P-23–P-30: block/unblock из обеих админок; повтор block при оставшемся PAT; повтор enable; два instances; interleaving read/block/unblock; старый PAT не оживает; unmanaged user не меняет lifecycle.
- P-10–P-14, P-31–P-35: read не выдаёт новый PAT; blocked без секрета; active без PAT → точный код; нет секрета в frontend, стандартных DTO, ошибках/логах/аудите.
- C-01–C-07: совместимость до/после cutover; исходный handler проверен относительно указанного commit; explicit migration не захватывает чужие аккаунты.
- Persistence и сериализация проверяются на реальных SQLite, MySQL и PostgreSQL по repo rules, включая upgrade и повторный startup.

## Оставшиеся согласования — информативно

Draft требует принятия точных DTO/ошибок, назначения доверенного principal и разрешения повторного чтения секрета. Одноразовый перенос существующих accounts и финальная отмена требуют отдельного операционного разрешения. Безопасность реализации ещё не проверена; realtime UI и строгий порядок локальных snapshots не обещаны.

Применимы [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) и [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/): server-side authorization, защищённый транспорт, отзыв credentials и исключение секретов из журналов. Полная матрица requirement IDs и подтверждение соответствия ещё не выполнены.

## Changelog

- v1 / v1.1 — 2026-09-07 — исходный Draft и correction loop.
- v1.2 — 2026-09-07 — минимальный create/read-current, общий lifecycle обеих админок; удалены дополнительные state/bind routes, historical replay и version platform. Реализация не выполнена.
- v1.2.1 — 2026-09-07 — correction loop: удаление запрещено до установления исходов всех in-flight create и исключения позднего выполнения.
- v1.3 — 2026-09-08 — согласован create/persist/классифицированная компенсация без durable intent; явно ограничены ambiguous recovery и повторное использование compensated identity.
