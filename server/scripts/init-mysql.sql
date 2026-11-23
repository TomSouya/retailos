CREATE DATABASE IF NOT EXISTS retailos
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'retailos'@'localhost' IDENTIFIED BY 'retailos_dev';
ALTER USER 'retailos'@'localhost' IDENTIFIED BY 'retailos_dev';

GRANT ALL PRIVILEGES ON retailos.* TO 'retailos'@'localhost';
FLUSH PRIVILEGES;
