CREATE TABLE IF NOT EXISTS quest_map_layout (
  quest_id varchar(96) PRIMARY KEY,
  x double precision NOT NULL CHECK (x BETWEEN 2 AND 98),
  y double precision NOT NULL CHECK (y BETWEEN 2 AND 98),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quest_map_layout_updated_idx
  ON quest_map_layout(updated_at DESC);
