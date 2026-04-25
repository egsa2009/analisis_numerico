-- =========================================================
-- SCHEMA SUPABASE  ·  Análisis Cuantitativo Numérico
-- Universos: Principal y Secundario  |  Principales 1-43, Diferente 1-16
-- Ejecutar este script desde:
--   Supabase Dashboard → SQL Editor → New Query → Pegar → Run
-- =========================================================

-- 1) Tabla principal -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sorteos (
    id          BIGSERIAL PRIMARY KEY,
    fecha       DATE     NOT NULL,
    tipo        TEXT     NOT NULL CHECK (tipo IN ('Principal','Secundario')),
    n1          SMALLINT NOT NULL CHECK (n1 BETWEEN 1 AND 43),
    n2          SMALLINT NOT NULL CHECK (n2 BETWEEN 1 AND 43),
    n3          SMALLINT NOT NULL CHECK (n3 BETWEEN 1 AND 43),
    n4          SMALLINT NOT NULL CHECK (n4 BETWEEN 1 AND 43),
    n5          SMALLINT NOT NULL CHECK (n5 BETWEEN 1 AND 43),
    diff        SMALLINT NOT NULL CHECK (diff BETWEEN 1 AND 16),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- evita duplicar la combinación fecha+tipo
    CONSTRAINT uq_fecha_tipo UNIQUE (fecha, tipo),
    -- evita repetidos dentro de la misma fila (5 números deben ser distintos)
    CONSTRAINT chk_no_repetidos CHECK (
        n1 <> n2 AND n1 <> n3 AND n1 <> n4 AND n1 <> n5 AND
        n2 <> n3 AND n2 <> n4 AND n2 <> n5 AND
        n3 <> n4 AND n3 <> n5 AND
        n4 <> n5
    )
);

-- 2) Índices útiles --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sorteos_fecha ON sorteos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_sorteos_tipo  ON sorteos (tipo);
CREATE INDEX IF NOT EXISTS idx_sorteos_tipo_fecha ON sorteos (tipo, fecha DESC);

-- 3) Vista útil: una fila por sorteo con array de números -----------------
CREATE OR REPLACE VIEW v_sorteos_array AS
SELECT
    id, fecha, tipo,
    ARRAY[n1,n2,n3,n4,n5] AS principales,
    diff,
    created_at
FROM sorteos;

-- 4) Row Level Security  ·  modo "uso personal abierto" ------------------
ALTER TABLE sorteos ENABLE ROW LEVEL SECURITY;

-- Lectura pública con anon key
DROP POLICY IF EXISTS sorteos_anon_select ON sorteos;
CREATE POLICY sorteos_anon_select
    ON sorteos
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Inserción pública con anon key (apropiado solo para uso personal)
DROP POLICY IF EXISTS sorteos_anon_insert ON sorteos;
CREATE POLICY sorteos_anon_insert
    ON sorteos
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- (opcional) Permitir update/delete con anon key — comenta estas dos
-- políticas si NO quieres permitir editar/borrar desde el HTML.
DROP POLICY IF EXISTS sorteos_anon_update ON sorteos;
CREATE POLICY sorteos_anon_update
    ON sorteos
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS sorteos_anon_delete ON sorteos;
CREATE POLICY sorteos_anon_delete
    ON sorteos
    FOR DELETE
    TO anon, authenticated
    USING (true);

-- 5) Notas ----------------------------------------------------------------
-- · La unique constraint (fecha,tipo) hace que insertar dos veces el mismo
--   sorteo lance error. El HTML lo maneja avisando al usuario.
-- · Si más adelante quieres autenticación, basta cambiar las políticas
--   reemplazando "true" por "auth.uid() = ..." según tu lógica.
-- · Para ver los datos: SELECT * FROM v_sorteos_array ORDER BY fecha DESC;
