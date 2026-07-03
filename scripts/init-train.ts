import { entrenar, predecir, evaluarPendientes } from '../lib/ml/servicio'
async function main() {
  for (const tipo of ['Principal', 'Secundario'] as const) {
    console.log('Entrenando', tipo, '...')
    const t = await entrenar(tipo)
    console.log('  ok=', (t as any).ok)
    const p = await predecir(tipo)
    console.log('  prediccion=', (p as any)?.prediccion?.numeros, 'diff', (p as any)?.prediccion?.diff, 'conf', (p as any)?.prediccion?.confianza)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
