-- =========================================================
-- SCHEMA: Tabla predicciones
-- Historial de predicciones del sistema con sus resultados
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =========================================================

CREATE TABLE IF NOT EXISTS predicciones (
    id              BIGSERIAL PRIMARY KEY,
    tipo            TEXT     NOT NULL CHECK (tipo IN ('Principal','Secundario')),
    generada_en     DATE     NOT NULL DEFAULT CURRENT_DATE,
    ultimo_sorteo   DATE     NOT NULL,   -- fecha del último sorteo conocido al generar la predicción

    -- Combo determinístico (top-5 por probabilidad ponderada)
    d1   SMALLINT NOT NULL,
    d2   SMALLINT NOT NULL,
    d3   SMALLINT NOT NULL,
    d4   SMALLINT NOT NULL,
    d5   SMALLINT NOT NULL,
    d_diff SMALLINT NOT NULL,

    -- Combo balanceado (mezcla calientes + fríos)
    b1   SMALLINT NOT NULL,
    b2   SMALLINT NOT NULL,
    b3   SMALLINT NOT NULL,
    b4   SMALLINT NOT NULL,
    b5   SMALLINT NOT NULL,
    b_diff SMALLINT NOT NULL,

    -- Pesos del modelo en el momento de generar la predicción
    w_freq    REAL NOT NULL,
    w_sequia  REAL NOT NULL,
    w_cooc    REAL NOT NULL,

    -- Resultado real (se rellena automáticamente cuando llega el sorteo siguiente)
    resultado_fecha DATE     DEFAULT NULL,
    r1    SMALLINT DEFAULT NULL,
    r2    SMALLINT DEFAULT NULL,
    r3    SMALLINT DEFAULT NULL,
    r4    SMALLINT DEFAULT NULL,
    r5    SMALLINT DEFAULT NULL,
    r_diff  SMALLINT DEFAULT NULL,
    aciertos_det    SMALLINT DEFAULT NULL,  -- cuántos del combo det. coincidieron (0-5)
    aciertos_bal    SMALLINT DEFAULT NULL,  -- cuántos del combo bal. coincidieron (0-5)
    diff_acertado   BOOLEAN  DEFAULT NULL,  -- si el número diferente acertó

    created_at  TIMESTAMPTZ DEFAULT NOW(),

    -- Evita duplicar predicciones para el mismo sorteo+tipo
    CONSTRAINT uq_pred_tipo_sorteo UNIQUE (tipo, ultimo_sorteo)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pred_tipo     ON predicciones (tipo);
CREATE INDEX IF NOT EXISTS idx_pred_sorteo   ON predicciones (ultimo_sorteo DESC);
CREATE INDEX IF NOT EXISTS idx_pred_generada ON predicciones (generada_en DESC);

-- Row Level Security
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pred_anon_select ON predicciones;
CREATE POLICY pred_anon_select
    ON predicciones FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS pred_anon_insert ON predicciones;
CREATE POLICY pred_anon_insert
    ON predicciones FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS pred_anon_update ON predicciones;
CREATE POLICY pred_anon_update
    ON predicciones FOR UPDATE TO anon, authenticated
    USING (true) WITH CHECK (true);

-- =========================================================
-- Verificación rápida (ejecutar por separado después):
-- SELECT tipo, COUNT(*) FROM predicciones GROUP BY tipo;
-- SELECT * FROM predicciones ORDER BY generada_en DESC LIMIT 10;
-- =========================================================
