# CREACOM — Fase 2: modelo comercial e IA

La Fase 1 queda preservada en este documento; la Fase 2 añade asistencia
comercial interna sin cambiar Meta, WhatsApp ni el dominio principal.

## IA comercial

`ai_configs` conserva las claves BYO cifradas con el mecanismo AES-256-GCM
existente. Los proveedores soportados son OpenAI, Anthropic y Groq; Groq usa
su endpoint compatible con Chat Completions. `base_url` y `model` son
configurables, pero las claves nunca se devuelven al navegador. El simulador de
`/agents` llama a `/api/ai/simulator`, no envía mensajes externos y limita sus
escrituras al `account_id` autenticado.

La respuesta estructurada sólo admite `reply` y una lista blanca de campos de
contacto/obra. El servidor descarta claves desconocidas, rechaza volúmenes no
positivos y enums inválidos, conserva valores humanos no vacíos y registra cada
cambio en `ai_change_log` sin prompts, secretos ni cadena de razonamiento.
La IA puede avanzar una obra abierta de Nuevo a Calificando cuando hay un dato
de calificación explícito; nunca cierra Ganado/No concretado ni sobreescribe
campos confirmados. Precio, descuentos, crédito, reclamos, excepciones o una
petición de asesor activan `HUMAN_REQUESTED`; al tomar el hilo se usa
`HUMAN_ACTIVE` y el auto-reply queda pausado. Reanudar desde Inbox vuelve a
`AI_ACTIVE` de forma explícita.

La Knowledge Base existente se reutiliza como contexto aprobado. Si no existe
un dato, la IA pregunta progresivamente; no inventa resistencia, volumen,
precios, fechas, disponibilidad, bomba ni acceso.

## Migración Fase 2

`20260915120000_creacom_ai_commercial.sql` amplía proveedores/base URL, añade
estado de handoff persistente y crea `ai_change_log` con RLS por cuenta.
Aplicar esta expansión sólo al proyecto Supabase autorizado
`bqehnefuivaojiegapei`; no usar `db push` sobre el historial alojado y no tocar
otros proyectos. En Preview usar una cuenta DEMO aislada y credenciales
seguras.

## Alcance y límites

Un contacto representa una persona/empresa; cada `deal` representa una obra.
No hay unicidad por contacto: un cliente puede tener varias obras. Se conservan
Inbox, contactos, automatizaciones y pipelines genéricos WACRM. Esta fase no
genera PDFs, precios ni recomendaciones estructurales y no conecta Groq, Meta
ni WhatsApp real. Proyecto autorizado: Supabase `wacrm-mvp-crm`
(`bqehnefuivaojiegapei`), repositorio `JeanLoor1703/wacrm`, Vercel
`sistema-ventas-creacom-hormigonera`. Otros proyectos y dominio principal fuera
de alcance.

## Esquema compatible

`deals` reutiliza título de obra, cliente, valor, moneda, asesor, etapa, notas
y fecha de cierre comercial. Nuevos campos:

| Campo | Significado / validación |
| --- | --- |
| `work_type`, `work_location` | Texto opcional, sin inferencias |
| `concrete_strength` | H-180, H-210, H-240, H-280, other, unknown |
| `concrete_strength_other` | Explicación requerida cuando resistencia = other |
| `estimated_volume_m3` | Decimal nullable, positivo, 3 decimales; NULL = pendiente |
| `scheduled_date` | Fundición/entrega prevista; NO sustituye `expected_close_date` |
| `needs_pump`, `mixer_access` | yes / no / unknown; desconocido no significa no |
| `loss_reason_id`, `loss_reason_detail` | Motivo por cuenta y explicación opcional/obligatoria |

`pipelines.model_key = creacom` activa las reglas comerciales;
`is_demo` excluye sus datos del dashboard oficial. Las claves técnicas de etapas
son `new`, `qualifying`, `ready_to_quote`, `quote_sent`, `negotiation`, `won`,
`not_converted`. Son únicas por pipeline y no cambian al renombrar/reordenar.

`deals.status` sigue siendo open / won / lost por compatibilidad. El trigger
deriva este valor de la etapa CREACOM: won → won, not_converted → lost, resto
→ open. No existe otro estado comercial independiente. Los pipelines genéricos
mantienen sus reglas anteriores. Para crear obra CREACOM se requieren cliente,
título y etapa; los demás datos se completan progresivamente.

Las FKs compuestas garantizan cuenta común entre cliente, pipeline, conversación,
asesor y motivo, y pertenencia de la etapa al pipeline. Protegen también escrituras
privilegiadas y cambios concurrentes de la cuenta del padre. Se conservan las FKs
originales: embeds Supabase usan explícitamente `deals_contact_id_fkey`,
`deals_stage_id_fkey` y `deals_assigned_to_fkey` para evitar ambigüedad.
La eliminación de contacto conserva obras mediante ON DELETE SET NULL.

## Motivos y permisos

Catálogo `deal_loss_reasons` por cuenta. Iniciales: Precio, No respondió,
Eligió competencia, Obra aplazada, Sin presupuesto, No cumple condiciones, Otro.
Otro exige explicación. Miembros leen; administradores/propietarios añaden y
activan/desactivan. No se eliminan motivos desde la interfaz. FK RESTRICT conserva
historial. Un motivo inactivo sigue siendo válido para editar una obra previamente
cerrada, pero no para un nuevo cierre. Cada cierre no concretado requiere motivo
antes de persistir. Todas las tablas mantienen RLS; RPC no recibe una cuenta
arbitraria ni utiliza claims editables para autorización.

## Interfaz y movimientos

El mismo Sheet sirve creación, edición, enlace desde contacto y cierre solicitado
por arrastre. Tres pestañas: Información comercial, Hormigón, Venta. Valores viven
en el componente padre y se conservan al cambiar de pestaña. Dos columnas en
escritorio, una en móvil; contenido con scroll interno y pie fijo de guardado.
Etiquetas asociadas, controles nativos/primitivas Base UI, foco visible y teclado.
Se reutilizan Inter/League Spartan, blanco, rojo CREACOM e iconos Lucide existentes.

Movimiento manual permitido incluso con campos pendientes. Arrastrar a
No concretado abre el formulario con etapa propuesta sin escribir. Cancelar no
cambia la oportunidad. Ganado, No concretado y Reabrir seleccionan una etapa
compatible y requieren guardar. La BD sincroniza resultado para todos los caminos,
incluidas automatizaciones. Enlace directo:
`/pipelines?pipeline=<pipeline-id>&deal=<deal-id>`.

## Métricas reales

RPC `creacom_metrics(p_pipeline_id uuid DEFAULT NULL)` es SECURITY INVOKER,
STABLE y con search_path fijo. Permisos de ejecución sólo authenticated/service_role.
RLS y membership limitan filas. Sin parámetro incluye todos los pipelines CREACOM
no DEMO de la cuenta; parámetro explícito sirve el resumen del embudo seleccionado,
incluido DEMO propio. Agregación SQL no depende del máximo de filas de PostgREST.

Cuenta cada etapa y abiertas en su estado actual. Ganadas/no concretadas son
acumuladas de TODO el historial, no del mes ni de una ventana del gráfico.
Suma sólo m³ registrados abiertos, en negociación y ganados; informa por separado
cuántas obras tienen volumen pendiente en cada grupo. Valor abierto/ganado por
moneda sin conversión. Cero registros devuelve ceros y listas vacías, error devuelve
mensaje/reintento, nunca cifras inventadas. Las métricas de contactos y conversaciones
quedan secundarias; el valor ponderado genérico no es KPI CREACOM.

Guardado y suscripción Realtime de `deals` refrescan tablero y agregados. La expansión
añade deals a la publicación; RLS sigue protegiendo eventos. Cargas async cancelan
actualizaciones después de desmontar.

## Migraciones y orden de entrega

1. `20260914232058_creacom_commercial_model.sql`: expansión, catálogo, campos,
   FKs, validación, métricas y Realtime. Aplicada al proyecto autorizado.
2. `20260915000512_creacom_relation_indexes.sql`: índices de las FKs compuestas,
   aplicada después de validar el esquema.
3. Se creó y probó sólo la cuenta aislada DEMO QA CREACOM (`is_demo = true`).
4. Tras repetir la inspección (pipeline oficial sin oportunidades y cinco etapas
   originales), se aplicó LAST `20260914234127_activate_creacom_pipeline.sql`.

La activación busca la cuenta por email del propietario autorizado, no por IDs
generados. Bloquea escrituras durante la inspección transaccional. Exige pipeline
Sales Pipeline único con CERO obras y exactamente las cinco etapas originales.
Conserva sus cinco IDs, Proposal Sent → Cotización enviada, añade Listo para cotizar
y No concretado, renombra a Ventas CREACOM. DEMO conserva pipeline y oportunidad;
sólo cambia Perdido → No concretado y asigna claves/marca DEMO. Una configuración
inesperada aborta toda la transacción. Si llegan datos, conservar filas, inventariar
etapas/resultados y preparar una correspondencia revisada; NO vaciar ni recrear.

### Historial local vs alojado

Local tiene 001_initial_schema.sql … 039_inbound_media_mirror.sql, seguidas de
040_harden_function_execute_privileges.sql y 041_harden_trigger_helpers.sql.
Alojado registró las primeras 39 con versiones timestamp (001 comienza
20260910030257; 039 es 20260910030649), y los hardenings como
`20260911200642_harden_function_execute_privileges` y
`20260911200737_harden_trigger_helpers`, sin prefijo 040/041.
La correspondencia es por nombre lógico/contenido, NO por número local de versión.

Antes de aplicar, listar historial alojado y confirmar ambos hardenings. Aplicar
ÚNICAMENTE el SQL de los dos archivos nuevos con nombres lógicos respectivos,
en su orden de entrega. MCP apply_migration puede asignar timestamp alojado distinto:
documentar nombre/version real en el informe. NO ejecutar `supabase db push` ciego,
NO reparar ni reejecutar 001–041. CI temporal sí reproduce todo desde cero.
Archivos nuevos fueron creados con Supabase CLI 2.113.0 `migration new`.

### Estado de entrega verificado

Proyecto Supabase alojado: `bqehnefuivaojiegapei`. El pipeline oficial quedó como
`Ventas CREACOM` con siete etapas y cero oportunidades al activarlo. El pipeline
`DEMO — Embudo CREACOM (auditoría)` conserva su oportunidad; `Sales Pipeline` y
los demás pipelines WACRM no se modificaron. Preview corresponde únicamente al
proyecto Vercel `sistema-ventas-creacom-hormigonera` y usa variables públicas de
Supabase más una clave de cifrado propia de Preview; no copia secretos de
producción.

El PR de entrega es `https://github.com/JeanLoor1703/wacrm/pull/1` en
`codex/creacom-opportunities`. CI general ejecuta lint, typecheck, 880 pruebas
Vitest y build; el workflow de migraciones ejecuta pgTAP (50 assertions), schema
smoke y Chromium secuencial. El navegador remoto del Preview sigue protegido por
Vercel Authentication, por lo que la validación E2E de navegador se realiza en
el stack temporal de CI sin desactivar esa protección.

## Pruebas y CI

Node 24 alineado con Vercel, npm ci/lockfile y caché npm. CI ejecuta lint,
`next typegen` antes de TypeScript para el checkout limpio. Un bootstrap exclusivo
de CI reproduce los grants CRUD que 001–041 asumían del dashboard alojado;
no se aplica a Supabase remoto y mantiene RLS. La carga segura de entorno usa
`scripts/run-with-env.mjs` para no propagar `--env-file` a workers de Node.
TypeScript, Vitest y build. Workflow Migrations siempre corre en PR/main sin filtros
de archivos: Supabase temporal (Postgres 17 + Auth + Data API), reset, schema smoke,
pgTAP, fixture QA, build y Playwright Chromium con un worker. No usa proyectos
alojados ni secretos de producción. Test SQL tiene rollback y dos cuentas con
owner/agent/viewer, FKs, persistencia, cierre/reapertura, motivos y >1000 filas.

E2E verifica login, creación/edición/búsqueda de cliente, dos obras, campos,
movimiento, motivo requerido/cancelación, cierres, reload, persistencia, enlace
desde cliente, logout/nuevo login y tres viewports. No omitir por falta de credenciales:
la configuración ausente hace fallar el check. Capturas/trazas/vídeos desactivados
para no almacenar sesiones o credenciales; revisión visual usa datos ficticios.

### Configuración QA segura

`scripts/seed-e2e.mjs --local` sólo acepta localhost. `--hosted` sólo acepta
el ref autorizado y crea el usuario aislado demo.qa.creacom@example.com, cuenta
DEMO QA CREACOM y pipeline marcado is_demo. Cuenta/propietario/perfil se verifican
antes de escribir. La service role se usa únicamente en el script Node de
aprovisionamiento, nunca en frontend. Configuración generada `.env.e2e.local`
está ignorada, no imprime contraseña; reutilización exige contraseña existente,
no rota usuarios. Tests verifican cuenta/pipeline DEMO antes de escribir y limpian
únicamente IDs de su ejecución. Variables E2E_BASE_URL y bypass de protección,
si hace falta, se suministran mediante entorno seguro.

## Recuperación

No hay migración DOWN que borre campos/datos. Antes de activación puede volver a
la aplicación anterior sin retirar el esquema expandido, porque el oficial sigue
genérico. Tras activación NO revertir a una aplicación que sólo escribe status:
necesita entender claves técnicas/cierre con motivo. Preferir corrección compatible
y un deployment previo compatible. Para conservación, exportar datos con canales
seguros y snapshot/backup disponible; nunca guardar datos privados en el repositorio.
Si el despliegue falla, no activar el oficial. No cambiar dominio ni otros proyectos.
