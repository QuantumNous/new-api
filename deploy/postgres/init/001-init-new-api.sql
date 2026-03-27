CREATE ROLE new_api_app LOGIN PASSWORD 'new_api_app_password';
CREATE ROLE new_api_log_ro LOGIN PASSWORD 'new_api_log_ro_password';

CREATE DATABASE new_api_main OWNER new_api_app;
CREATE DATABASE new_api_log OWNER new_api_app;

\connect new_api_log

GRANT CONNECT ON DATABASE new_api_log TO new_api_log_ro;
GRANT USAGE ON SCHEMA public TO new_api_log_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO new_api_log_ro;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO new_api_log_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE new_api_app IN SCHEMA public
GRANT SELECT ON TABLES TO new_api_log_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE new_api_app IN SCHEMA public
GRANT SELECT ON SEQUENCES TO new_api_log_ro;
