CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
CREATE TYPE user_role AS ENUM ('ADMIN', 'CONTRIBUTOR');
--> statement-breakpoint
CREATE TYPE disaster_status AS ENUM ('active', 'contained', 'resolved');
--> statement-breakpoint
CREATE TYPE resource_type AS ENUM ('shelter', 'hospital', 'food', 'water', 'rescue');
--> statement-breakpoint
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE disasters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(160) NOT NULL,
  description text NOT NULL,
  location_name varchar(180) NOT NULL,
  location geography(Point,4326) NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  status disaster_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX disasters_status_idx ON disasters(status);
--> statement-breakpoint
CREATE INDEX disasters_created_by_idx ON disasters(created_by);
--> statement-breakpoint
CREATE INDEX disasters_tags_gin_idx ON disasters USING gin(tags);
--> statement-breakpoint
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  type resource_type NOT NULL,
  location geography(Point,4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX resources_type_idx ON resources(type);
--> statement-breakpoint
CREATE INDEX resources_location_gist_idx ON resources USING gist(location);
