# Fiscus

Panel público de solo lectura de los proyectos de inversión del Estado peruano. Este repositorio contiene
el backend de datos (una ingesta diaria de datos del MEF hacia Supabase) y la app en `apps/mobile` (iOS, Android y web).

## Fuentes de datos

Dos fuentes del MEF cargan la misma tabla `investments`, con el CUI como clave.

### Reporte SSI (gobiernos regionales, diario desde Perú)

Reporte "Seguimiento de Inversiones" (SSI) del MEF, descargado como XLSX por departamento:

- `POST https://ofi5.mef.gob.pe/inviertews/Ssi/expRepSSIDet`
- Cuerpo: `{"sect":"","plie":"<1..25>","dpto":0,"prov":0,"dist":0,"tipo":"GR"}`. `plie` es el código del departamento.
- Cada llamada tarda unos 50 s, por lo que los departamentos se consultan uno tras otro. Cada intento tiene un timeout de 120 s y se reintenta 3 veces con backoff exponencial.
- Solo gobiernos regionales (GR), incluidos los proyectos cerrados. El host bloquea los runners de GitHub, por lo que se ejecuta desde una máquina en Perú (ver "Ingesta diaria").

### Datos abiertos (todos los niveles, proyectos activos, GitHub Actions)

`https://fs.datosabiertos.mef.gob.pe/datastorefiles/DETALLE_INVERSIONES.csv`: unos 250 MB, UTF-8 con
BOM, todos los campos entrecomillados, unas 150,000 filas. Lista solo las inversiones ACTIVAS de los
gobiernos nacional (GN), regionales (GR) y locales (GL), con ubicación (ubigeo, coordenadas), avance físico y la
unidad ejecutora. El MEF no lo actualiza todos los días.

- `OpenDataCsvSource` envía primero una solicitud HEAD. Cuando `Last-Modified` y `Content-Length` coinciden con
  los de la última ingesta exitosa en `source_snapshots`, la ejecución lo registra en el log y termina con código 0 sin descargar
  (`--force` ingesta de todos modos).
- El archivo se lee en streaming y se analiza fila por fila con `csv-parse` (nunca se carga completo). `ALTERNATIVA`
  (texto libre, cerca del 37 % de los bytes) es descartada por el parser, y las columnas sin mapear nunca se almacenan.
- `accrued_total = DEVEN_ACUMUL_ANIO_ANT + DEV_ANIO_ACTUAL`, redondeado a centavos. Coincide con el total del SSI
  al centavo (CUI 2094808: S/ 1,459,731,800.72). `PIM_ANIO_ACTUAL` y `DEV_ANIO_ACTUAL` van a las columnas
  existentes `pim` y `accrued_year`, que en el SSI contienen las mismas cifras.
- Las coordenadas fuera del rectángulo delimitador de Perú (latitud -19 a 0, longitud -82 a -68), incluido el
  `0.0` de la fuente, se guardan como nulas. `physical_progress` es nulo salvo que `TIENE_AVAN_FISICO = SI` y
  el valor esté entre 0 y 100. Los meses `yyyymm` del estilo `ULTIMO_DEVENGADO` se convierten en fechas del primer día del mes.
- `department_code` sale de los dos primeros dígitos de `UBIGEO` (los códigos de departamento del INEI coinciden con 1-25), y
  luego del nombre en `DEPARTAMENTO` cuando el ubigeo está en blanco. Las inversiones nacionales multidepartamento
  (ubigeo `99...`) no tienen departamento y solo cuentan a nivel nacional.
- Las filas sin CUI (67 en el archivo de octubre de 2026) se omiten; si un CUI se repite, se conserva la última fila.
- Las filas se insertan o actualizan (upsert) de 1,000 en 1,000 mediante `public.upsert_open_data_investments`. Regla de propiedad
  (`data_source`): una vez que el SSI cargó una inversión (`ssi`), la ingesta de datos abiertos solo completa las
  columnas que le faltan al SSI (ubicación, coordenadas, avance físico, devengado de años anteriores, saldo
  pendiente, unidad ejecutora, `open_data_updated_at`). Las cifras del SSI no se tocan, porque se
  actualizan a diario y el archivo de datos abiertos puede tener varios días de antigüedad, y el historial de costos no registra
  los cambios de ida y vuelta. Las inversiones que solo tiene el archivo (`open_data`) reciben todas las columnas.
- `.github/workflows/open-data-ingest.yml` la ejecuta a diario a las 10:00 UTC (05:00 Lima, después de la ejecución del SSI)
  y por activación manual (la entrada `force` reingesta un archivo sin cambios).
- Las filas sin cambios no se reescriben. El trigger `touch_ingested_at` omite una actualización cuando ninguna columna de datos
  cambió, para ambas ingestas. Por lo tanto, `ingested_at`, `source_updated_at` y `open_data_updated_at`
  se mueven solo cuando cambian los datos; la frescura de cada fuente completa está en `ingest_runs` (SSI) y
  `source_snapshots` (datos abiertos). La pantalla de detalle muestra `source_updated_at` como "Último cambio en los
  datos del MEF: dd/mm/yyyy" (la última vez que cambiaron las cifras del proyecto); los pies de página conservan el
  "Datos actualizados el …" de la fuente completa.

Vistas. Las vistas existentes (`region_comparison`, `stalled_investments`, `accrual_reference_month`,
`function_summary`, `department_function_summary`, `department_summary`) ahora filtran
`government_level = 'GR'` de forma explícita, por lo que sus números se mantienen cuando llegan filas nacionales y
locales. Las nuevas vistas `*_by_level` (`region_comparison_by_level`, `stalled_investments_by_level`,
`function_summary_by_level`, `department_function_summary_by_level`) tienen una columna `government_level`
(`GN`, `GR`, `GL`, o `ALL` para todos los niveles) para que la app filtre. `region_comparison_by_level`
solo tiene los 25 departamentos. La app lee únicamente las vistas `*_by_level` y filtra por nivel sus lecturas directas de
`investments` y `investment_cost_changes` (ver "Niveles de gobierno").

`supabase/migrations/20261101000000_entity_comparison.sql` agrega:

- `entity_comparison`: una fila por entidad y `government_level` por ámbito. `scope_department_code = 0`
  es todo el Perú (todos los proyectos de la entidad, incluidos los que no tienen departamento; `department_code`
  se completa solo cuando todos están en un mismo departamento); `1-25` cuenta solo los proyectos de la entidad en ese
  departamento, de modo que un ministerio aparece en cada región donde trabaja. Las mismas cifras que la comparación
  de regiones (costos válidos, solo aumentos positivos, sobregastados, sin gasto reciente a partir de
  `stalled_investments_by_level`). Dos ramas `UNION ALL`, de modo que un filtro de ámbito poda la otra rama
  y un filtro de departamento usa `investments_department_level_idx`. Es una vista simple: cada página
  vuelve a agregar el ámbito (un escaneo completo de unas 165 mil filas a nivel nacional).
- `accrual_reference_month_all_levels`: el final de la ventana de datos sobre todos los niveles, el mes
  de referencia de `stalled_investments_by_level`.
- `investments_cost_increase_pct_idx`, para el ranking "Mayor aumento (%)" en la tabla más grande.

Tamaño (medido en Postgres 17 con el archivo de octubre de 2026 más 27,296 filas GR tipo SSI, autovacuum desactivado):
`investments` ocupa 142 MB tras la primera carga de ambas fuentes (111 MB de heap, 31 MB de índices) e
`investment_cost_changes` 28 MB (una fila `first_seen` por inversión). Una segunda ingesta idéntica de ambas
fuentes agrega 0 bytes. Una ejecución en la que cambia cerca del 1 % de las filas agrega cerca de 1.3 MB a `investments` y
0.3 MB al historial.

### Inversiones cerradas (datos abiertos, todos los niveles, GitHub Actions)

`https://fs.datosabiertos.mef.gob.pe/datastorefiles/CIERRE_INVERSIONES.csv`: unos 120 MB, mismo host y
formato que el archivo de activas (UTF-8 con BOM, todos los campos entrecomillados). Lista todas las inversiones CERRADAS
(`ESTADO = CERRADO`) de los gobiernos nacional, regionales y locales: 120,429 filas en el archivo de octubre de 2026,
116,983 CUI distintos (GL 72,563, GN 31,705, GR 12,715), 3,446 filas sin CUI (todas GN) y ningún CUI
repetido. No comparte ningún CUI con el archivo de activas.

- `pnpm ingest:open-data-closed` (la CLI de datos abiertos con `--dataset closed`) reutiliza la fuente en streaming,
  la verificación de snapshot y el upsert por lotes del archivo de activas, con su propia fila en `source_snapshots`
  (`mef_cierre_inversiones`): si `Last-Modified` y `Content-Length` no cambian, se omite la descarga y solo
  se actualiza `checked_at`. Las filas sin CUI se omiten; si un CUI se repite, se conserva la última fila.
- **Privacidad.** `RESPONSABLE_UEI` es el nombre de una persona (el responsable oficial de la unidad ejecutora).
  El parser del CSV descarta la columna, por lo que nunca llega al mapeador, a la salida del dry-run ni a la base de datos.
  Los nombres de las unidades OPMI/UF/UEI y las demás columnas sin mapear tampoco se almacenan. El fixture versionado
  (`packages/ingest/test/fixtures/closed-data-sample.csv`) la reemplaza por un marcador de posición.
- Mapeo: las mismas columnas que el archivo de activas donde existen (`DEVEN_ACUMULADO` es `accrued_total`,
  `CONTROL_CONCURR` el costo del control concurrente, `BENEFICIARIO` los beneficiarios, `NOM_UEP` la unidad
  ejecutora, `PROGRAMA`/`SUBPROGRAMA` la división y el grupo funcional), más columnas de cierre
  (`supabase/migrations/20261106000000_closed_investments.sql`): `closed_at` (`FEC_CIERRE`),
  `closure_description` (`DES_CIERRE`, el tipo de cierre, como "Sí, con liquidación" o "No culminada",
  recortado, de máximo 200 caracteres), `liquidation_amount` (`TOTAL_LIQUIDACION`, tal como se publica: ocurre el 0),
  `liquidated_at`, `culminated` (`CULMINADA` SÍ/NO, nulo si está en blanco), `physical_start_at` /
  `physical_end_at` (`INICIO`/`CULMINA_EJEC_FISICA`) y `operation_start_at` (`FEC_INI_OPER`). El
  archivo no tiene presupuesto del año actual, avance físico ni saldo pendiente.
- Equivalencia de funciones: `PROGRAMA` contiene la división funcional, igual que en el archivo de activas, por lo que el trigger
  de equivalencia se aplica sin cambios. Unos 14,100 proyectos cerrados traen etiquetas de la clasificación antigua (EDUCACION Y
  CULTURA, SALUD Y SANEAMIENTO, AGRARIA, ENERGIA Y RECURSOS MINERALES...), mapeadas por su división o por
  la fila comodín de la función cuando la división no tiene una fila propia.
- Propiedad (`data_source`): el SSI conserva todas las columnas que publica (los proyectos GR cerrados están en ambas
  fuentes); el archivo de cerradas completa solo las columnas de datos abiertos y de cierre de las filas del SSI. Las filas que solo tiene el archivo
  de cerradas son `open_data_closed`. Un proyecto que se cierra sale del archivo de activas y aparece en el de
  cerradas: el upsert de cerradas (`upsert_closed_investments`) toma la fila (`open_data` →
  `open_data_closed`), su estado pasa a CERRADO, se limpian las columnas que el archivo de cerradas no tiene (`pim`,
  `pim_year`, `accrued_year`, `accrued_previous_years`, `pending_balance`, `physical_progress`), y el
  historial de costos registra una fila solo si cambió `viable_amount` o `updated_cost`. El upsert de activas hace lo
  inverso para un proyecto que está en el archivo de activas (`open_data`, columnas de cierre limpiadas). Una reingesta idéntica
  escribe 0 filas: los triggers de equivalencia y `touch_ingested_at` no cambian y las columnas nuevas son
  columnas de datos.
- `open-data-ingest.yml` la ejecuta justo después de la ingesta de activas, con el mismo calendario diario; se ejecuta incluso
  si la ingesta de activas falló (no si fallaron los tests) y el issue de fallo cubre ambas.

Dry run real sobre el archivo completo (`pnpm ingest:open-data-closed --dry-run`): 120,429 filas leídas, 116,983
con upsert, 3,446 sin CUI, 0 duplicados, 45,225 con coordenadas dentro de Perú, 170 sin departamento,
116,805 con fecha de cierre, 51,539 con monto de liquidación, 76,280 culminadas; 12 s incluida la
descarga, 259 MB de RSS máximo.

Tamaño (Postgres 17, todas las migraciones, autovacuum desactivado, el archivo de activas de octubre de 2026 más todos los proyectos GR de
ambos archivos como filas SSI, y luego el archivo de cerradas): `investments` crece de 153 MB (163,116 filas) a 243 MB
(267,384 filas), +90 MB (+94.5 MB en bytes: 160.0 MB → 254.5 MB), e `investment_cost_changes` de 28 MB
a 45 MB, +18 MB (una fila `first_seen` por cada CUI nuevo, 104,268). Una reingesta idéntica de cualquiera de los archivos escribe
0 filas y agrega 0 bytes.

Vistas. Las vistas existentes conservan su significado (todos los estados, como siempre: el SSI ya cargaba
proyectos GR cerrados), por lo que una app que no conoce los estados lee los mismos números. Las nuevas
vistas `*_by_status` (`region_comparison_by_status`, `function_summary_by_status`,
`department_function_summary_by_status`, `entity_comparison_by_status`) agregan una columna `status_group`:
`ACTIVE` (estado ACTIVO), `CLOSED` (CERRADO) o `ALL`; los demás estados solo cuentan bajo `ALL`. Leen
dos vistas internas (`investment_status_groups`, `stalled_status_groups`) que repiten cada fila una vez por
grupo de estado y grupo de nivel como ramas `UNION ALL` con columnas constantes, de modo que un filtro sobre
`status_group` y `government_level` poda las demás ramas y una lectura agrega solo el grupo
solicitado (medido sobre 267 mil filas: comparación de regiones 0.2 s, una página de entidad nacional 0.34 s, resúmenes por función
por debajo de 0.1 s; las versiones con `GROUP BY CUBE` tardaron 1-3.7 s porque ningún filtro llega por debajo de los grouping sets).
`map_points` y `map_list` incorporan `status_filter` (`ALL` por defecto, de modo que los llamadores antiguos conservan
sus resultados) y `map_points` devuelve el `status` de cada proyecto. "Sin gasto reciente" ya exige
`status = 'ACTIVO'` en todas partes (ambas vistas stalled, `map_points`, `map_list`), por lo que un proyecto cerrado
nunca queda como "Sin gasto reciente"; `accrual_reference_month_all_levels` sigue siendo el último mes de todas las filas (el archivo de cerradas
termina en el mismo mes que el de activas, 2026-10).

### Obras paralizadas (Contraloría, trimestral, GitHub Actions semanal)

Fuente: Contraloría General de la República, "Informe de obras paralizadas en el territorio nacional"
([colección en gob.pe](https://www.gob.pe/institucion/contraloria/colecciones/18230-obras-paralizadas-documentos)).
Cada edición trimestral tiene su propia URL; su Anexo N° 01 es una hoja de cálculo (~0.7 MB, ~2,300 filas) con
una fila por obra registrada en INFOBRAS: código INFOBRAS, CUI, SNIP, entidad, nivel, ubicación, modalidad,
causal de la paralización (codificada, p. ej. "2 INCUMPLIMIENTO DE CONTRATO"), avance físico, costo según el
expediente técnico, saldo de obra, indicador de inventario del MEF e informe situacional,
indicador de lista priorizada. Sin nombres de personas; no se conservan la unidad de la Contraloría ni los rangos.

`pnpm ingest:paralyzed` (`.github/workflows/paralyzed-works-ingest.yml`, lunes a las 11:00 UTC y bajo
demanda) lee la página de la colección, elige la edición con la fecha de corte más reciente a partir de su título ("a junio
de 2026" → 2026-06-30), lee la página de la edición para obtener el enlace del Anexo N° 01 y, a menos que la URL de ese archivo
ya esté en `source_snapshots` (fuente `contraloria_obras_paralizadas`, columnas `edition_cutoff` y
`edition_url`), lo descarga y hace upsert de cada obra en `official_paralyzed_works` por
`(edition_cutoff, infobras_code)`. Se conservan todas las ediciones. Tres solicitudes GET como máximo, con encabezados por defecto.
Mapeo: celdas con serial de Excel o fecha → fechas, causal separada en código y etiqueta, SI/NO → booleanos, CUI y
SNIP 0 → nulo, "P. C. DEL CALLAO" → Callao, solo enlaces de informe http(s). Un archivo sin las
columnas esperadas, o sin ningún código INFOBRAS, hace fallar la ejecución (y abre un issue `ingest-failure`).

Vistas (migración `20261107000000_official_paralyzed_works.sql`, todas `security_invoker`, legibles por
anon): `latest_paralyzed_works` (última edición), `paralyzed_by_cui` (por CUI: cantidad de obras, causal principal =
la obra con el mayor saldo de obra, rango de avance, saldo de obra total, códigos INFOBRAS)
y `paralyzed_investments` (esa vista unida con `investments`, para los filtros de ámbito, nivel y estado).
`map_points` y `map_list` incorporan `only_paralyzed` (por defecto false) y devuelven `paralyzed`. Se comprobó que la ficha
pública de INFOBRAS `Mapa/Sumario?ObraId=<CODIGO INFOBRAS>` corresponde a la misma obra (ObraId 45282 →
CUI 2151761, como en la hoja de cálculo); la app solo enlaza a ella.

Edición de junio de 2026 (dry run, 2026-10-31): 2,262 obras, 2,084 CUI distintos, 134 sin CUI; 1,543 GL,
396 GN, 323 GR; 733 en el inventario del MEF.

```bash
pnpm ingest:paralyzed --dry-run [--out /absolute/rows.ndjson]
pnpm ingest:paralyzed --dry-run --xlsx /path/anexo-01.xlsx --cutoff 2026-06-30 --published 2026-08-17
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:paralyzed [--force]
```

"Obra paralizada (Contraloría)" es un registro oficial; "Sin gasto reciente" es una regla de Fiscus sobre los
devengados del MEF. La app los mantiene separados (glosario, guía, bloque de detalle) y siempre atribuye el primero:
"Fuente: Contraloría General de la República".

### Obras y contratistas de INFOBRAS (Contraloría, GitHub Actions semanal)

Fuente: Contraloría General de la República, datos abiertos de INFOBRAS
([página de DataSets](https://infobras.contraloria.gob.pe/InfobrasWeb/DataSets), publicados "para ser
descargada, reutilizada o compartida"). Un XLSX (~57 MB; su única hoja pesa ~730 MB de XML,
191,180 filas de 97 celdas de cadena en línea, con un bloque de título de 3 filas antes del encabezado) regenerado a diario con
un nombre con fecha (`DataSet-Obras-Publicas 30-10-2026`). Los decimales usan un espacio ("693405 56" = 693405.56).

`pnpm ingest:infobras` (`.github/workflows/infobras-ingest.yml`, martes a las 11:00 UTC y bajo demanda) lee
la página de DataSets para obtener el enlace vigente, omite la ejecución cuando el nombre del archivo o su Content-Length coincide con
el de la última ingesta (`source_snapshots`, fuente `infobras_obras`: `edition_url` y `content_length`); en caso contrario
descarga el archivo en streaming a un archivo temporal, descomprime la hoja del ZIP y la tokeniza con un parser
SAX (sin cargar el libro completo en memoria), mapea cada fila y hace upsert de lotes de 1,000 mediante
`upsert_infobras_works` (service role; las filas sin cambios no se reescriben). Las obras que faltan en un archivo nuevo
se marcan con `removed_at` y quedan ocultas por RLS, nunca se eliminan (`mark_removed_infobras_works`, que se niega
cuando el archivo tiene menos de la mitad de las obras visibles). Luego `refresh_contractor_totals()` recalcula los
totales de contratistas (también en las ejecuciones omitidas, porque su alcance proviene de `investments`). Dos solicitudes GET
por ejecución, con encabezados por defecto.

**Privacidad.** El dataset nombra a personas. La ingesta lee solo las columnas que almacena: nunca `Nombres
Apellidos (Supervisión)`, `Nombres Apellidos (Residente)` ni los comentarios de texto libre. Un contratista o
supervisor cuyo RUC empieza con 10, 15 o 17 (personas naturales; el RUC 10 incluye el DNI) conserva
`*_kind = 'persona_natural'` y ni nombre ni RUC. Las empresas (RUC 20…) y los consorcios (RUC 20… con nombre
"CONSORCIO…", o código de consorcio del OSCE C + 10 dígitos) conservan nombre e identificador. Cualquier otro identificador conserva
solo un nombre que empiece con "CONSORCIO". Las check constraints de la tabla hacen cumplir la regla.

**Frescura.** El archivo es nuevo cada día, pero su contenido se detiene alrededor de marzo de 2026: `data_as_of`,
la última `Fecha de registro de avance` del archivo (2026-03-31 el 2026-10-30), se guarda en
`source_snapshots.data_as_of`, se expone en `data_freshness` y se muestra donde aparecen los datos ("Datos de
INFOBRAS al 31/03/2026. El estado puede haber cambiado."). El estado de INFOBRAS nunca se presenta como
vigente; el informe de paralizadas de la Contraloría sigue siendo la fuente autorizada de "Paralizada".

Esquema (migración `20261108000000_infobras_works.sql`): `infobras_works` (una fila por obra, solo las
columnas que muestra la app; montos y plazos en cero se guardan como nulos), las vistas `infobras_by_cui`,
`contractor_summary` y `contractor_works`, la vista materializada `contractor_scope_totals` (contratista ×
departamento, nivel y grupo de estado de la inversión de cada obra; una obra sin un CUI en `investments`
cuenta solo sin filtros) y `contractor_ranking(level, department, status_filter, sort_by, …)`, que
respeta los filtros de ámbito, nivel y estado de la app. Las obras de la última edición de la Contraloría se unen
en vivo por `infobras_code`.

Medido en postgres 17 con el archivo completo: `infobras_works` 39 MB con índices (26 MB de heap, 14 MB de
índices) para 191,180 obras; conservar solo las obras cuyo CUI está en `investments` serían 27 MB (133,048
obras), no es necesario. `contractor_scope_totals` 6–11 MB (35,252 contratistas; más filas cuando las obras se reparten
en varios ámbitos). El ranking se lee en 50–200 ms; la agregación por fila sin la vista materializada
tomó 400–560 ms.

Dry run sobre el archivo en vivo (2026-10-31): 191,180 obras, 0 sin código, 0 repetidas; 170,793 con CUI;
Finalizado 122,212, Sin Ejecución 42,860, En Ejecución 24,579, Paralizada 1,529. Contratistas: 49,698
empresa, 28,767 consorcio (15,799 con RUC 20, 12,453 con código C, 515 solo con nombre), 1,972
persona natural, 110,743 ninguno (en su mayoría administración directa). Supervisores: 10,010 empresa, 5,809
consorcio, 8,292 persona natural. 35,252 identificadores de contratista distintos. data_as_of 2026-03-31.
58 s incluida la descarga, 246 MB de RSS máximo.

```bash
pnpm ingest:infobras --dry-run [--out /absolute/rows.ndjson]
pnpm ingest:infobras --dry-run --file /path/DataSet-Obras-Publicas.xlsx
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:infobras [--force]
```

El fixture de pruebas (`packages/ingest/test/fixtures/infobras-obras-sample.xlsx`, 23 filas reales) lo construye
`scripts/build-infobras-fixture.ts`, que reemplaza todos los nombres de personas, todos los RUC de personas naturales y los
comentarios.

`infobras.contraloria.gob.pe` corta las conexiones de los runners alojados en GitHub (la primera ejecución del workflow
agotó el tiempo a los 10 s, igual que el host del SSI del MEF), por lo que la ingesta semanal se ejecuta desde la PC, replicando el timer
del SSI de "Ingesta diaria" (mismo worktree `Fiscus-ingest` y mismos pasos `ExecStartPre` de actualización).
`infobras-ingest.yml` se mantiene solo para activación manual:

```ini
# ~/.config/systemd/user/fiscus-infobras.service
[Unit]
Description=Fiscus: ingest the INFOBRAS obras dataset into Supabase
Wants=network-online.target
After=network-online.target
OnFailure=fiscus-notify-failure@%n.service

[Service]
Type=oneshot
WorkingDirectory=/path/to/Fiscus
EnvironmentFile=/path/to/Fiscus/.env.local
ExecStart=/path/to/pnpm ingest:infobras
TimeoutStartSec=30min
```

```ini
# ~/.config/systemd/user/fiscus-infobras.timer
[Timer]
OnCalendar=Tue *-*-* 06:00:00 America/Lima
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
```

(`systemctl --user daemon-reload && systemctl --user enable --now fiscus-infobras.timer`.)

## Estructura

```
packages/ingest/src/
  domain/        mapeadores de Investment y OpenDataInvestment, normalizadores, métricas de costo,
                 códigos de departamento (puro)
  ports/         InvestmentSource, InvestmentRepository, OpenDataSource, OpenDataRepository
  adapters/      MefXlsxSource (HTTP + XLSX), ssiReportParser, SupabaseInvestmentRepository,
                 JsonFileInvestmentRepository (dry-run), OpenDataCsvSource (HEAD + CSV en streaming),
                 SupabaseOpenDataRepository, DryRunOpenDataRepository
  application/   runIngest (aislamiento de fallos por departamento), runSnapshotIngest (verificación de snapshot,
                 upsert por lotes) detrás de runOpenDataIngest y runClosedDataIngest
  cli.ts         punto de entrada del SSI
  openDataCli.ts punto de entrada de datos abiertos
apps/mobile/src/
  app/           rutas de Expo Router: (tabs) index, rankings, categories, search; region; map; investment/[cui]; category/[fn]
  features/      investments (dominio, query specs, puerto, adaptadores Supabase + en memoria, hooks),
                 department, home, rankings, regions, categories, search, investment-detail (contenedor + vista),
                 share-card (imagen para compartir: presentación, tarjeta, captura y compartir)
  shared/        tokens de tema, formateadores, átomos de UI
supabase/migrations/   esquema, RLS, vistas de resumen
.github/workflows/     ingest.yml (ingesta SSI manual), open-data-ingest.yml (ingestas diarias de datos abiertos activos y cerrados),
                       ci.yml (typecheck + pruebas)
```

El parser de XLSX usa `exceljs`. Está mantenido en npm, tiene tipos de TypeScript y expone valores de celda tipados
de hipervínculo, texto enriquecido y fórmula que el parser desenvuelve. El paquete `xlsx` de SheetJS en npm
está estancado en la versión 0.18.5, y las versiones más nuevas solo se publican en el CDN propio de SheetJS.

## Ejecución local

Requiere Node 22+ y pnpm.

```sh
pnpm install
pnpm test
pnpm typecheck

# Dry run: sin base de datos. Escribe JSON normalizado en packages/ingest/out/
DEPARTMENTS=4 pnpm ingest --dry-run
# o elige el directorio de salida
DEPARTMENTS=4,15 pnpm ingest --dry-run --out /absolute/path

# Ejecución real hacia Supabase
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest
```

```sh
# Datos abiertos. Dry run: lee el archivo en streaming e imprime conteos por nivel, coordenadas, duplicados...
pnpm ingest:open-data --dry-run
pnpm ingest:open-data --dry-run --source /path/to/DETALLE_INVERSIONES.csv --out /absolute/rows.ndjson
pnpm ingest:open-data --dry-run --limit 1000
# Ejecución real (se omite si el archivo no cambió desde la última ingesta; --force ingesta de todos modos)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:open-data [--force]

# Inversiones cerradas (CIERRE_INVERSIONES.csv): mismas opciones; OPEN_DATA_CLOSED_SOURCE reemplaza la URL
pnpm ingest:open-data-closed --dry-run
pnpm ingest:open-data-closed --dry-run --source /path/to/CIERRE_INVERSIONES.csv --out /absolute/closed.ndjson
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:open-data-closed [--force]
```

`--source` acepta una URL o una ruta local (por defecto: la URL del MEF); `--out` escribe las filas exactas que una
ejecución real enviaría, como NDJSON; `--limit N` se detiene tras N filas y nunca registra el snapshot.

Deja `DEPARTMENTS` sin definir para ingestar los 25 departamentos. El proceso termina con código distinto de cero solo cuando todos los
departamentos fallan. Las filas sin CUI se omiten y se cuentan (`rowsSkipped`, `ingest_runs.rows_skipped`).

Aplica el esquema con la CLI de Supabase (`supabase db push`) o pegando
`supabase/migrations/*.sql` en el editor SQL.

## App móvil y web

Expo SDK 58 con Expo Router, TanStack Query y `@supabase/supabase-js`. Lee con la clave anon pública, y
RLS mantiene esa clave en solo lectura.

```sh
cp apps/mobile/.env.example apps/mobile/.env   # luego define EXPO_PUBLIC_SUPABASE_ANON_KEY
pnpm --filter @fiscus/mobile start             # código QR para Expo Go; presiona w para web
pnpm --filter @fiscus/mobile web               # solo web
pnpm --filter @fiscus/mobile test
pnpm --filter @fiscus/mobile typecheck
pnpm --filter @fiscus/mobile export:web        # compilación web estática en apps/mobile/dist
```

| Variable | Propósito |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto (pública) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave anon (pública, de solo lectura mediante RLS). Nunca uses aquí la clave service role. |
| `EXPO_PUBLIC_USE_MOCK` | `1` usa registros de ejemplo incluidos de Arequipa, por lo que no se necesitan credenciales |
| `EXPO_PUBLIC_MOCK_STALE` | Con el modo mock, `1` fecha la última actualización de la muestra varios días atrás, para mostrar el banner de datos desactualizados |
| `EXPO_PUBLIC_SITE_URL` | Opcional. Dirección web pública (`https://rainherz.github.io/Fiscus`); si se define, la tarjeta para compartir y el mensaje compartido enlazan a `<site>/investment/<cui>` |
| `EXPO_BASE_URL` | Opcional, solo en tiempo de compilación. Subruta de la exportación web (`/Fiscus`); si no se define, la app vive en `/` |

Para ejecutar la app en un teléfono, instala Expo Go, mantén el teléfono en la misma red que tu computadora y escanea
el código QR que imprime `start`. Si la red bloquea la LAN, usa `pnpm --filter @fiscus/mobile exec expo start --tunnel`.

Ámbito: cada pantalla muestra todo el Perú ("TODO EL PERÚ", el valor por defecto) o un departamento. La última
elección se guarda en el dispositivo con `@react-native-async-storage/async-storage` (localStorage en web); si
el almacenamiento falla, la app vuelve a todo el Perú. Las pantallas esperan hasta que se lee la elección guardada, de modo que
nunca consultan ni muestran un ámbito equivocado (mientras tanto, el encabezado muestra un marcador de posición). Los métodos del repositorio
reciben un `departmentCode` opcional: undefined significa todo el Perú, y las query specs omiten el filtro de
departamento. Las lecturas nacionales siguen paginadas o limitadas, nunca traen la tabla completa.

Niveles de gobierno: el ámbito también guarda un nivel, "Todos los niveles" (por defecto), "Gobierno nacional",
"Gobiernos regionales" o "Gobiernos locales", almacenado en el dispositivo (`fiscus.level`) igual que la región.
Se elige en el selector de región ("NIVEL DE GOBIERNO", un control segmentado sobre las regiones; el
ranking de regiones se actualiza de inmediato) y se muestra en el encabezado como segunda línea bajo la región. Esto no agrega
ninguna fila extra a cada pantalla a 320 px. Cada lectura lo respeta: las lecturas directas de `investments` y
`investment_cost_changes` agregan `government_level = <code>` salvo que sean todos los niveles, y las lecturas de vistas
usan las vistas `*_by_level` con `government_level = 'ALL' | <code>` (`stalled_investments_by_level` no
tiene filas `ALL`, por lo que simplemente no se filtra). Una búsqueda exacta por CUI ignora el nivel, igual que ignora la
región. Las notas al pie nombran el nivel ("Gobiernos regionales. Montos en soles corrientes."; las nacionales y
las de todo el país agregan "No incluye proyectos de varias regiones."). Las filas y el detalle llevan una etiqueta GN/GR/GL
anunciada como "Gobierno nacional/regional/local". Los proyectos nacionales sin departamento se leen como "Varias
regiones" y nunca aparecen en una región. El detalle agrega entidad, unidad ejecutora, provincia y distrito
cuando existen, y "AVANCE FÍSICO 42 %" (`physical_progress`) como una barra simple, aparte de la barra rayada
"GASTADO X % DEL COSTO". Su línea de fuente sigue a `data_source` (SSI o datos abiertos).

Filtro de estado: el ámbito también guarda un estado de proyecto, "Activos" (por defecto, `status = 'ACTIVO'`),
"Cerrados" (`CERRADO`) o "Todos", almacenado en el dispositivo (`fiscus.status`) y elegido en el selector de región
("ESTADO DEL PROYECTO", bajo el nivel); la segunda línea del encabezado lo muestra después del nivel
("TODOS LOS NIVELES · PROYECTOS ACTIVOS"). Cada lectura lo respeta: las lecturas directas de `investments` agregan
`status = 'ACTIVO' | 'CERRADO'` (una búsqueda exacta por CUI lo ignora), los aumentos recientes filtran el estado de la
inversión incrustada, las lecturas de vistas usan las vistas `*_by_status` con `status_group`, y el mapa envía
`status_filter`. El valor por defecto conserva el significado de las pantallas (proyectos activos); cambia los números
de las cifras regionales, que antes incluían los proyectos GR cerrados que publica el SSI (ahora aparecen
en "Cerrados" y "Todos"). Las notas al pie de la comparación de regiones nombran el estado. Las filas cerradas llevan una
etiqueta "GN · CERRADO" (anunciada "Gobierno nacional, proyecto cerrado"); el detalle agrega un bloque "CIERRE DE LA
INVERSIÓN" (fecha de cierre, tipo de cierre, culminada, liquidación cuando supera S/ 0, inicio y fin de
ejecución física, inicio de operación, solo lo que publica el MEF) con ayudas del glosario ("Cierre de la
inversión", "Liquidación"), y su línea de fuente nombra "Cierre de inversiones". "Sin gasto reciente" y
"Más tiempo en curso" solo se aplican a proyectos activos: con "Cerrados", sus pestañas de Rankings (y los
ordenamientos de entidad y región por proyectos sin gasto reciente) conservan su lugar pero muestran "Este criterio se aplica solo a proyectos
activos…" en lugar de una lista, el bloque de inicio se oculta y el mapa oculta su chip "Sin gasto reciente".
El mapa dibuja los proyectos cerrados como círculos huecos, y la leyenda lo indica. El modo demo agrega tres proyectos
cerrados marcados "(demo)".

Entidades: una pestaña de Rankings (`/rankings?tab=entities&sort=…`) ordena `entity_comparison` en el ámbito y
nivel, paginada por la vista, con los ordenamientos de la comparación de regiones (S/, %, sin gasto reciente, gasto sobre el
costo; solo entidades con un valor mayor que cero; el ordenamiento por % exige más de S/ 1 M aprobado en los proyectos
que aumentaron). Al tocar una entidad se abre `/entity?name=…&level=…`: sus proyectos en la región actual,
con las pestañas de ranking de proyectos, filtrados por la entidad y su propio nivel. El modo demo agrega proyectos nacionales y
locales marcados "(demo)", un proyecto nacional sin departamento y un proyecto local con
avance físico y coordenadas.

INFOBRAS: la pantalla de detalle muestra "OBRAS EN INFOBRAS" para un CUI que tenga obras allí (cinco, luego "Ver
más"): estado de ejecución, avance físico real frente al planificado, contratista (nombre de la empresa o consorcio y
RUC, o "Persona natural"), monto del contrato, supervisión (misma regla), adicionales de obra, deductivos,
ampliaciones, fechas de recepción y liquidación, el enlace "Ver ficha en INFOBRAS →" y "Datos de INFOBRAS al
dd/mm/yyyy. El estado puede haber cambiado." El bloque de paralizadas de la Contraloría sigue siendo el titular. La
pestaña "Contratistas" de Rankings (`/rankings?tab=contractors&sort=contract|additional|paralyzed`) ordena
empresas y consorcios por monto de contrato, adicionales de obra u obras en el último informe de la Contraloría,
en el ámbito, nivel y estado (los de la inversión de cada obra). Al tocar uno se abre
`/contractor?ruc=…`: totales nacionales y sus obras, cada una abre su proyecto o, si no tiene uno en Fiscus,
su ficha de INFOBRAS. Los términos del glosario (INFOBRAS, Contratista, Supervisión, Adicional de obra, Deductivo,
Ampliación de plazo), una sección de la guía y la fuente del pie de página ("Contraloría – INFOBRAS (datos al …)") van
con ello. El modo demo agrega obras de proyectos demo con empresas "(demo)" (RUC que no pasan el
dígito verificador de la SUNAT) y un contratista persona natural.

La pantalla "Categorías" lee `department_function_summary_by_level` para un departamento y
`function_summary_by_level` para todo el Perú.

Equivalencia de funciones (`supabase/migrations/20261105000000_function_crosswalk.sql`): `investments.function`
mezcla la antigua clasificación funcional del MEF (proyectos declarados viables aproximadamente entre 2002 y 2018, p. ej. "EDUCACION Y
CULTURA", "SALUD Y SANEAMIENTO") con la vigente (desde 2009, p. ej. "EDUCACIÓN", "SALUD",
"SANEAMIENTO"). `public.function_crosswalk` mapea las etiquetas antiguas por (función, división funcional),
porque algunas funciones antiguas se dividen en varias nuevas: primero la fila exacta (función, división), luego
la fila comodín de la función (división nula), y si no, la función se mapea a sí misma; las etiquetas se comparan exactamente como las publica el MEF,
tras recortar los espacios. Un trigger `BEFORE INSERT OR UPDATE` (`set_function_canonical`) guarda el resultado en
`investments.function_canonical`; se dispara antes de `touch_ingested_at` (los triggers BEFORE del mismo evento se ejecutan en
orden de nombre), de modo que un upsert idéntico sigue sin tener efecto (sin nueva versión de fila, sin fila de historial). Las vistas
de resumen por función agrupan por `function_canonical` pero conservan el nombre de columna `function`; Categorías y su
detalle por función lo usan, y el detalle muestra la función canónica más "Clasificación original del MEF: …"
cuando difiere. `apps/mobile/src/features/investments/domain/functionCrosswalk.ts` replica la semilla (una prueba
las compara) para el modo demo y la sección "Clasificación por función" de la guía. Cambiar la
equivalencia requiere una migración que además vuelva a rellenar `function_canonical`.

Historial de costos: el MEF solo publica el costo actual, por lo que Fiscus registra su propio historial en
`investment_cost_changes` desde el 27/10/2026
(`supabase/migrations/20261027200000_create_investment_cost_changes.sql`). Cada inversión empieza con una
fila `baseline`; los triggers agregan una fila `changed` cuando cambia `viable_amount` o `updated_cost`. La pantalla de
detalle lo muestra como "Historial del costo", y el inicio lista los últimos aumentos del ámbito seleccionado bajo
"Aumentos recientes". El historial anterior se desconoce. El modo demo incluye un historial inventado para Majes
Siguas II, solo para que estas pantallas tengan algo que mostrar.

Sin gasto reciente: proyectos activos (`status = 'ACTIVO'`, costo actualizado válido) que gastaron entre el 5 % y el
95 % de su costo y cuyo último mes de devengado está a más de 12 meses del mes de referencia, el
último `last_accrual_month` del dataset (no la fecha de hoy, para que los retrasos de publicación del MEF no inflen la lista).
La vista `stalled_investments` (`supabase/migrations/20261029000000_create_stalled_investments.sql`)
aplica la regla y agrega `months_without_accrual` y `pending_amount`. La app lee
`stalled_investments_by_level`, la misma regla sobre todos los niveles frente al mes de referencia de todo el
dataset (`accrual_reference_month_all_levels`), y los muestra como una pestaña "Sin gasto reciente" en Rankings, un bloque en el inicio y una línea en la pantalla de detalle. El modo demo agrega
proyectos inventados marcados "(demo)" para que estas pantallas tengan algo que mostrar.

Selector de región: el selector del encabezado ("TODO EL PERÚ ▾" o el nombre de la región) abre la pantalla
"Elegir región" (`/region`). Su primera opción es "Todo el Perú"; debajo, compara todos los departamentos, ordenados por aumento total de costo (S/ o %), proyectos "Sin gasto reciente",
o proyectos que gastaron más que su costo actualizado. Lee `region_comparison_by_level` para
el nivel seleccionado: las cifras de costo solo usan costos
actualizados válidos, y el total de aumentos suma solo los aumentos positivos (las reducciones no se compensan). La elección actual
se marca como "ACTUAL"; al tocar una opción se selecciona y se vuelve a la pantalla anterior. Los departamentos sin
datos, y todos los departamentos mientras la comparación carga o falla, se listan alfabéticamente para que elegir una
región nunca dependa de ella. Rankings, Categorías y Buscar funcionan dentro del ámbito seleccionado; al listar todo el Perú, cada fila muestra su
región, y Buscar busca nombres en todo el país (un CUI exacto siempre se busca a nivel nacional). Los enlaces antiguos
`?tab=regions` abren la pestaña de Rankings por defecto.

Inicio nacional: "EL MAYOR AUMENTO DEL PAÍS" (con su región), el top 5 nacional de aumentos,
"Regiones con más aumentos" (top 5 de regiones por aumento total desde `region_comparison_by_level`; al tocar una se
selecciona, "Ver las 25" abre el selector), luego "Sin gasto reciente" y "Aumentos recientes" para todo el Perú.
El inicio de una región conserva su propio diseño. La vista más antigua `department_summary` no cambia pero la app no la usa.

Comparar regiones (`/compare?a=4&b=8`, compartible): dos departamentos lado a lado desde `region_comparison_by_level`,
una fila por métrica (tamaño, aumentos, ejecución) con ambos valores impresos y un par de barras en espejo (región
izquierda en tinta, derecha en amarillo señal con contorno de tinta), más el proyecto de cada región con el mayor
aumento. Las filas de porcentaje de proyectos dividen entre los proyectos con un costo actualizado válido. Los códigos faltantes o desconocidos
vuelven a la región actual (o a la de mayor aumento total) y a la siguiente por aumento total, y la
URL se reescribe. Elegir una región aquí nunca cambia el ámbito de la app. Se abre desde "Comparar dos
regiones" en el inicio nacional y en la parte superior del selector, y desde "Comparar con otra región" en el inicio
de una región.

Compartir: "COMPARTIR" en la pantalla de detalle renderiza fuera de pantalla una imagen de 1080x1350 (4:5) del proyecto,
la captura con `react-native-view-shot` y muestra una vista previa de ese mismo PNG con "Compartir" y "Cancelar", de modo que
las personas vean exactamente lo que envían. La tarjeta reutiliza las reglas del detalle (aumento de costo, aviso de costo no válido,
porcentaje gastado, sobregasto, datos inusuales, "Sin gasto") y cita el CUI, la fuente del MEF (SSI o datos abiertos) y la fecha en que las cifras cambiaron por última vez. En
iOS y Android el PNG va a la hoja de compartir del sistema mediante `expo-sharing`. En web, view-shot dibuja el
DOM con `html2canvas-pro` (su dependencia peer web opcional, cargada de forma diferida como un chunk separado), y luego la página usa
la Web Share API con el archivo cuando `navigator.canShare({ files })` lo permite; de lo contrario descarga
`fiscus-<cui>.png`. La lógica de la tarjeta está en `features/share-card/shareCardPresentation.ts`.

Guía (`/guia`, "CÓMO LEER ESTOS DATOS"): qué es Fiscus, las fuentes, cómo leer un proyecto, el
glosario, las reglas de Fiscus y las limitaciones conocidas. Enlazada desde el pie de página ("Cómo leer estos
datos"), desde Inicio en teléfonos y como quinto elemento del encabezado ("GUÍA") en escritorio (no cabe en
tableta). Un pequeño "?" (`features/glossary/TermHint.tsx`, área táctil de 44 px) junto a las etiquetas de cifras en el
detalle, el héroe del inicio, los encabezados de ranking de escritorio, la tarjeta del mapa y la comparación abre la definición del término: un popover
en tableta y escritorio, una hoja inferior en teléfonos. Cada definición vive en `features/glossary/terms.ts`;
una prueba verifica que cada término al que se refiere la app esté definido allí.

Mapa (`/map`, `/map?f=increase,stalled,overspent`, `/map?cui=…`): los proyectos con coordenadas (`latitude`/`longitude` de datos abiertos, cerca del 77 %
de las filas; la pantalla lo indica) en el ámbito y nivel actuales. Se abre desde "Ver en el mapa →" en el inicio
y, centrado en el proyecto con su tarjeta abierta, desde "VER EN EL MAPA" en el detalle de un proyecto (se muestra solo
cuando tiene coordenadas). Es una pantalla de pila (stack) en lugar de una quinta pestaña, que no cabía a 320 px.
A nivel nacional encuadra Perú; con un departamento encuadra los límites aproximados del departamento
(`features/map/mapRequest.ts`).

- Una sola implementación de mapa: `features/map/mapHtml.ts` construye una página de MapLibre GL JS 5.24.0 (desde unpkg,
  fijada, con integridad de subrecursos sha384; la compilación de un solo archivo de 5.x incluye su worker, por lo que el hash
  cubre todo el código, mientras que 6.x es solo ESM con chunks cargados por separado). iOS/Android la cargan en `react-native-webview` (`source={{ html }}`, incluido en
  Expo Go); la web la carga en un iframe con sandbox (`srcDoc`, solo scripts). La página solo dibuja y
  reporta; los datos, las etiquetas y los estados permanecen en React Native.
- Puente (`features/map/mapBridge.ts`): la página envía `ready`, `moved` (bbox + zoom de MapLibre al cargar y en
  `moveend`), `pointPressed`, `mapPressed` y `loadFailed` (MapLibre no cargó, no hay WebGL, o falló el estilo
  o los primeros tiles; la pantalla muestra entonces su error y "Ver como lista"); la app envía `setData` y `highlight`. Cada mensaje
  de la página se analiza y valida (los tipos desconocidos, los números inválidos, las cajas invertidas y los CUI con caracteres no numéricos se
  descartan). En la web solo se leen los mensajes del propio iframe del mapa.
- Solicitudes: 300 ms después de que el mapa deja de moverse, la caja se recorta a Perú, se redondea hacia afuera a 0.01° y
  se envía con el zoom, el ámbito y el nivel a `getMapPoints`. Los zooms de MapLibre cuentan tiles de 512 px y
  `map_points` dimensiona las celdas sobre tiles de 256 px, por lo que la solicitud usa `floor(zoom + 1)` (`toTileZoom`), lo que
  mantiene una celda en 64 px en pantalla. La vista anterior permanece en pantalla mientras
  carga la siguiente; una línea de estado sobre el mapa dice "Cargando…", errores (con "Reintentar"), un área
  vacía, o cuando solo se muestran los primeros 500 proyectos.
- Los clústeres y los puntos son una sola fuente GeoJSON con capas de círculos y símbolos WebGL; la app calcula las
  etiquetas y los tamaños y los pasa como propiedades de las features. Las etiquetas de los clústeres usan las fuentes del propio estilo (Noto
  Sans Bold, servidas por OpenFreeMap junto con los tiles, por lo que cargan siempre que carga el mapa base) en lugar de un
  marcador HTML por clúster. Los clústeres son círculos de tinta con un conteo compacto amarillo ("1.2 mil"), dimensionados con una
  escala logarítmica; al tocar uno se acerca dos niveles (hasta el zoom 12 de MapLibre, donde el servidor envía proyectos). Los puntos son amarillos con contorno de tinta cuando el proyecto tiene un aumento de
  costo válido positivo, y pequeños puntos de tinta en caso contrario. Una leyenda nativa fija sobre el mapa nombra las tres marcas
  ("Con aumento de costo", "Sin aumento", "Grupo de proyectos (toca para acercar)"); en teléfonos se puede
  contraer. "Ver como lista" va a Rankings. El mapa se anuncia como complementario.
- Controles sobre el mapa (`features/map/MapControls.tsx`): el ámbito ("TODO EL PERÚ  CAMBIAR →" abre
  `/region`; una región nueva remonta el mapa sobre sus límites), el nivel de gobierno (el nivel global de la app, el mismo estado que
  el selector de región) y tres chips de filtro combinados con AND: "Con aumento"
  (aumento positivo sobre un costo válido), "Sin gasto reciente" (la regla stalled de `domain/stalled.ts`) y
  "Gastó más que su costo" (costo válido, devengado por encima de él). Los filtros viven en la URL (`f`, analizado y escrito
  en un orden fijo por `features/map/mapFilters.ts`), por lo que un mapa filtrado se puede compartir.
- Lista de la vista (`features/map/MapProjectList.tsx`): los proyectos de la misma caja, ámbito y filtros,
  de mayor a menor aumento (luego costo actualizado), 30 por página con "Cargar más", actualizada junto con el mapa (mismo
  debounce). Desde 768 px es un panel lateral junto al mapa; en teléfonos una barra bajo el mapa dice "N
  proyectos en esta zona" y abre la lista sobre la parte inferior del mapa (cubriéndolo en lugar de
  reducirlo, de modo que la vista y la lista se mantengan iguales). No interviene ninguna biblioteca de gestos.
- Tarjeta (`features/map/MapPointCard.tsx`): nombre, etiqueta de nivel, entidad, "+S/ X M · +Y%" (o "Sin aumento", o
  el aviso de costo no válido), "COSTO ACTUAL", "GASTADO X % DEL COSTO", "AVANCE FÍSICO X %" cuando se reporta,
  "Sin gasto desde mmm yyyy" cuando está en esa condición (stalled), y "Ver detalle →". Una fila de la lista trae sus cifras; un
  punto tocado en el mapa se lee por CUI (`useInvestment`). El proyecto seleccionado siempre se dibuja y
  se resalta, incluso dentro de un clúster (`withSelected`).
- Mapa base: teselas vectoriales OpenFreeMap Positron (`https://tiles.openfreemap.org/styles/positron`): gratuitas, sin
  clave, sin límites de solicitudes. La atribución que exige OpenFreeMap ("OpenFreeMap © OpenMapTiles Data from
  OpenStreetMap") está siempre visible mediante el control de atribución de MapLibre; sus enlaces se abren en el navegador
  del sistema en iOS/Android. No se usan los servidores de tiles de OpenStreetMap (su política prohíbe el tráfico de apps).
- El clustering se ejecuta en Postgres: `map_points(min_lat, min_lon, max_lat, max_lon, zoom, level = 'ALL',
  department = null)` (`supabase/migrations/20261102000000_map_points.sql`, security invoker, stable,
  ejecutable por anon/authenticated). Desde el zoom 13, o con a lo sumo 500 proyectos en la caja, devuelve hasta
  500 proyectos (de mayor a menor aumento); en caso contrario, celdas de cuadrícula de un cuarto de tile (`360 / 2^zoom / 4`
  grados) con conteo, centroide, suma de aumentos válidos positivos, mayor porcentaje válido y proyectos
  con aumento, como máximo 400 celdas. El filtro bbox usa `investments_coordinates_idx`. El adaptador en memoria
  aplica las mismas reglas (`domain/mapPoints.ts`); las filas demo llevan coordenadas demo
  aproximadas.
- Filtros y lista en Postgres (`supabase/migrations/20261103000000_map_filters_and_list.sql`):
  `map_points` incorpora `only_increase`, `only_stalled` y `only_overspent` (por defecto false; los clústeres cuentan
  solo los proyectos que coinciden). Se elimina y se vuelve a crear con los mismos grants, porque una
  sobrecarga haría ambiguas las llamadas originales de siete argumentos; la app envía los argumentos de filtro solo cuando un
  filtro está activo. `map_list(min_lat, min_lon, max_lat, max_lon, level, department, only_increase,
  only_stalled, only_overspent, page_limit = 30, page_offset = 0)` devuelve las columnas de la lista y de la
  tarjeta más `stalled` y `total_count` (un conteo de ventana), ordenadas por `cost_increase desc nulls last,
  updated_cost desc nulls last, cui`; `page_limit` tiene un tope de 100.

## Web

La compilación web se publica en GitHub Pages: **https://rainherz.github.io/Fiscus/**

- **Despliegue**: `.github/workflows/web-deploy.yml` se ejecuta en cada push a `main` que toque
  `apps/mobile/**`, `pnpm-lock.yaml` o el workflow, y por activación manual. Ejecuta las pruebas de la app móvil y
  `expo export --platform web`, y luego despliega con `actions/deploy-pages` (fuente de Pages: GitHub Actions).
- **Ruta base**: el sitio vive bajo `/Fiscus/`. `apps/mobile/app.config.ts` define
  `experiments.baseUrl` de Expo a partir de `EXPO_BASE_URL`, de modo que los assets, las fuentes y los enlaces de Expo Router reciben el prefijo.
  Sin ella (`expo start` local), la app se queda en `/`.
- **Deep links**: la exportación es una aplicación de página única (`web.output: "single"`). Pages responde a las rutas desconocidas,
  como `/Fiscus/investment/2088142`, con `404.html`, del cual el workflow hace una copia de `index.html`,
  de modo que cada ruta carga en una visita directa y al refrescar (con estado HTTP 404, que los navegadores ignoran).
  También se agrega `.nojekyll`.
- **Variables de entorno en compilación**: `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` provienen de los
  secrets `SUPABASE_URL` y `SUPABASE_ANON_KEY`, `EXPO_PUBLIC_USE_MOCK=0`,
  `EXPO_PUBLIC_SITE_URL=https://rainherz.github.io/Fiscus`. Allí nunca se usa la clave service role.
- **Metadatos de la página**: el título, la descripción, las etiquetas Open Graph/Twitter y `lang="es"` viven en
  `apps/mobile/public/index.html`, la plantilla HTML de la exportación de página única.

Compila la variante de Pages en local (datos demo, sin claves; `EXPO_NO_DOTENV=1` omite `apps/mobile/.env`):

```sh
cd apps/mobile
EXPO_NO_DOTENV=1 EXPO_BASE_URL=/Fiscus EXPO_PUBLIC_USE_MOCK=1 pnpm exec expo export --platform web --output-dir dist
cp dist/index.html dist/404.html   # luego sirve dist/ bajo /Fiscus/ con 404.html como respaldo
```

## Ingesta diaria

`ofi5.mef.gob.pe` corta las conexiones TCP de los runners alojados en GitHub (IP de centros de datos de EE. UU.), por lo que la ingesta
no puede ejecutarse con un calendario de GitHub Actions. Se ejecuta desde una máquina en Perú mediante un timer de usuario de systemd:

```ini
# ~/.config/systemd/user/fiscus-ingest.service
[Unit]
Description=Fiscus: ingest MEF SSI report into Supabase
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/Fiscus
# .env.local contiene SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
EnvironmentFile=/path/to/Fiscus/.env.local
ExecStart=/path/to/pnpm ingest
TimeoutStartSec=90min
```

```ini
# ~/.config/systemd/user/fiscus-ingest.timer
[Timer]
OnCalendar=*-*-* 04:00:00 America/Lima
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
```

```sh
systemctl --user daemon-reload
systemctl --user enable --now fiscus-ingest.timer
systemctl --user start fiscus-ingest        # ejecutar ahora
journalctl --user -u fiscus-ingest -f       # seguir los logs
```

`Persistent=true` ejecuta una ingesta perdida en el siguiente inicio de sesión cuando la máquina estaba apagada a las 04:00.
El workflow `ingest.yml` se mantiene solo para activación manual.

## Monitoreo

Tres señales, cada una visible sin iniciar sesión en un servidor:

**Datos de frescura.** `public.data_freshness` (migración `20261104000000_data_freshness.sql`) tiene una
fila por fuente, legible con la clave anon:

| `source` | `last_success_at` | `last_checked_at` |
|---|---|---|
| `ssi` | fin de la última fila de `ingest_runs` con al menos un departamento ingestado | fin de la última ejecución, exitosa o no |
| `mef_detalle_inversiones` | `source_snapshots.ingested_at`: la última vez que se ingestó el archivo | `source_snapshots.checked_at`: última ejecución exitosa, también cuando el archivo no cambió y se omitió |
| `mef_cierre_inversiones` | lo mismo, para el archivo de inversiones cerradas | lo mismo, para el archivo de inversiones cerradas |
| `contraloria_obras_paralizadas` | última vez que se ingestó una edición (`edition_cutoff` guarda su fecha de corte) | última ejecución semanal exitosa, también cuando la edición ya estaba ingestada |
| `infobras_obras` | última vez que se ingestó un archivo (`data_as_of` guarda la fecha que describen sus datos) | última ejecución semanal exitosa, también cuando se omitió el archivo |

Una ejecución del SSI cuenta como exitosa cuando `departments_ok` no está vacío, la misma regla que el código de salida de la
CLI (sale con 1 solo cuando todos los departamentos fallaron). Los departamentos que fallaron en una ejecución parcial están
en `ingest_runs.departments_failed`.

**En la app.** Cuando el último éxito del SSI tiene más de 48 h, cada pantalla muestra un banner bajo
el encabezado: "Los datos podrían estar desactualizados. Última actualización: dd/mm/yyyy hh:mm."
(hora de Lima). La persona lectora puede descartarlo durante la sesión. El pie de página muestra "Datos actualizados el …"
(último éxito del SSI) y "Datos abiertos revisados el …" (última verificación de datos abiertos). Los datos abiertos
no se evalúan para el banner: el MEF actualiza ese archivo con poca frecuencia.

**Issues de GitHub.**

- `data-freshness.yml` se ejecuta a diario a las 15:00 UTC (10:00 Lima, después de ambas ingestas) y bajo demanda. Lee
  `data_freshness` con el secret `SUPABASE_ANON_KEY` y, cuando el último éxito del SSI o la
  última verificación de cualquiera de los dos archivos de datos abiertos (inversiones activas o cerradas) tiene más de 36 h, o la última
  verificación semanal de obras paralizadas o la verificación semanal de INFOBRAS tiene más de 9 días (nunca se evalúan la antigüedad de la
  edición trimestral ni el `data_as_of` de INFOBRAS; en su lugar la app muestra "Corte: junio 2026 (hace 4 meses)"
  y "Datos de INFOBRAS al 31/03/2026"), abre el
  issue "Datos desactualizados" (etiqueta `data-stale`) o actualiza su tabla de estado. Cierra el
  issue cuando todas las fuentes vuelven a estar al día. Una fuente sin fila se considera desactualizada, por lo que el archivo de cerradas aparece como
  desactualizado hasta su primera ingesta tras el despliegue. Lógica:
  `packages/ingest/src/freshness/` (`pnpm --filter @fiscus/ingest freshness --dry-run` imprime la
  evaluación sin tocar los issues).
- `open-data-ingest.yml` abre el issue "Falló la ingesta de datos abiertos" (etiqueta
  `ingest-failure`) cuando falla cualquiera de las ingestas de la ejecución (inversiones activas o cerradas), o comenta en
  él si ya está abierto, con la URL de la ejecución.
- La ingesta local del SSI reporta los fallos con `scripts/notify-ingest-failure.sh <unit>`: abre el
  issue "Falló la ingesta: <unit>" (etiqueta `ingest-failure`), o comenta en el que esté abierto, con las
  últimas 50 líneas del journal de la unidad. Las claves, los tokens, los valores `KEY=`/`TOKEN=`, las cadenas opacas largas y el
  directorio home se reemplazan antes de enviar nada. Usa el login local de `gh`. Las etiquetas se
  crean en el primer uso.

Conexión del script a las unidades systemd de "Ingesta diaria" (`OnFailure=` lo inicia cuando el servicio de ingesta
falla, `%n` pasa el nombre de la unidad fallida):

```ini
# ~/.config/systemd/user/fiscus-notify-failure@.service
[Unit]
Description=Fiscus: report the failure of %i as a GitHub issue

[Service]
Type=oneshot
WorkingDirectory=/path/to/Fiscus
# gh debe estar en el PATH y con sesión iniciada (gh auth login), o define GH_TOKEN en un EnvironmentFile.
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/path/to/Fiscus/scripts/notify-ingest-failure.sh %i
```

```ini
# Agrega a la sección [Unit] de ~/.config/systemd/user/fiscus-ingest.service
OnFailure=fiscus-notify-failure@%n.service
```

```sh
systemctl --user daemon-reload
systemctl --user start fiscus-notify-failure@fiscus-ingest.service   # prueba: abre el issue o comenta en él
```

Una ejecución en la que solo fallan algunos departamentos termina con código 0, por lo que no dispara `OnFailure=`; se refleja en
`departments_failed` y, si ningún departamento tiene éxito durante 36 h, en el issue "Datos desactualizados".

## Secretos (GitHub Actions)

| Secret | Propósito |
|---|---|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role. Omite RLS, por lo que debe usarse solo en el servidor y nunca enviarse a los clientes. |
| `SUPABASE_ANON_KEY` | Clave anon pública, incluida en la compilación web (`web-deploy.yml`) y usada en solo lectura por `data-freshness.yml` |

El panel público lee con la clave anon. RLS permite que la clave anon ejecute SELECT y nada más.

## Advertencias conocidas

- **Cadena TLS incompleta.** `ofi5.mef.gob.pe` no envía su certificado intermedio. La verificación
  no se desactiva. En cambio, el intermedio (Entrust OV TLS Issuing RSA CA 2, de
  `http://crt.sectigo.com/EntrustOVTLSIssuingRSACA2.crt`) está versionado como
  `packages/ingest/certs/entrust-ov-tls-issuing-rsa-ca2.pem` y se carga con `NODE_EXTRA_CA_CERTS`
  (en el script `ingest` y en el workflow). Si el MEF rota su certificado, reemplaza ese archivo.
- **Los gobiernos nacional y locales provienen solo de datos abiertos.** La ingesta del SSI solicita `tipo: "GR"`.
  Los proyectos GN y GL activos provienen de `DETALLE_INVERSIONES.csv` y los cerrados de
  `CIERRE_INVERSIONES.csv`; ninguno tiene proyectos en otros estados (p. ej. desactivados), por lo que esos solo
  están en Fiscus cuando el SSI los publica (GR).
- **Etiqueta del año del PIM.** Los encabezados del reporte SSI dicen `PIM 2023` / `DEVENGADO 2023` incluso en los reportes de 2026,
  y las filas del SSI guardan ese año del encabezado en `pim_year`. El archivo de datos abiertos tiene las mismas cifras como
  `PIM_ANIO_ACTUAL` / `DEV_ANIO_ACTUAL` con `ANIO_PROCESO = 2026` (verificado en los CUI 2114611 y
  2322636), por lo que son el presupuesto y el devengado del año actual. Las filas de datos abiertos guardan `pim_year = 2026`.
- `execution_progress` es nulo cuando `accrued_total` está vacío. No se fuerza a 0, porque la fuente
  no dice si vacío significa "sin devengado" o "desconocido".
- **`execution_progress` es dinero, no avance físico.** Es `accrued_total / updated_cost`, la
  proporción del costo actualizado que ya se gastó. La app lo etiqueta "Gastado X % del costo". Puede superar
  el 100 % legítimamente (cerca del 12 % de los proyectos con datos): la barra se limita al 100 % y la app indica
  el sobregasto en soles.
- **Costos actualizados de relleno y truncados.** El MEF publica algunos valores de `updated_cost` como S/ 1,
  3, 5 o 10, y otros que parecen truncados (p. ej. S/ 4,558.66 para un proyecto con un monto viable de S/ 1,990,720,
  lo que se leería como 31,206 % gastado). Un costo actualizado no es válido cuando es menor que
  S/ 1,000, o menor que el 1 % de un `viable_amount` positivo (solo se aplica el piso de S/ 1,000 cuando el
  monto viable falta o no es positivo). Entonces `updated_cost_valid` es false y
  `cost_increase`, `cost_increase_pct` y `execution_progress` son nulos
  (`supabase/migrations/20261027000000_invalidate_placeholder_updated_cost.sql` y
  `20261028000000_relative_updated_cost_validity_and_spent_anomaly.sql`; replicado en
  `packages/ingest/src/domain/metrics.ts`). La app deja esos proyectos fuera del héroe del inicio y de
  los rankings de aumento y de costo, y muestra "Costo actualizado no válido en la fuente MEF" en su
  pantalla de detalle.
- **Totales devengados inusuales.** Algunos proyectos tienen un costo actualizado coherente pero un total devengado muy
  por encima de él (p. ej. CUI 2057689: S/ 18.8 M devengados frente a S/ 299,700, 6,262 %). Siguen visibles:
  `spent_anomaly` es true cuando `execution_progress` supera 10, y la app agrega
  "Dato inusual en la fuente MEF: lo gastado supera 10 veces el costo actualizado." bajo la barra
  (pantalla de detalle y héroe del inicio), junto a la línea habitual de sobregasto.
