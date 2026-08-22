# Speech de presentación (2–3 min)

Ensayar en voz alta. Tener estas dos frases copiadas por si el micrófono falla:

1. `Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón.`
2. `Retirá 600 bolsas del lote 241 de Pancani.`

Pantalla en `http://localhost:3000` con el stock visible **antes** de hablar.

---

## Guión (~2 min 20 s)

**Problema (20 s)** — *mostrar la tabla, no tocar nada todavía.*

Hoy el stock de semilla está en cuatro lugares: tres frigoríficos y un galpón, alrededor de 150 lotes. El registro es una planilla que varias personas editan a la vez. Nadie tiene una visión única de cuánto hay y dónde. Las diferencias aparecen cuando ya hay que entregarle el pedido al cliente.

**Qué reemplaza (20 s)** — *señalar columnas Pancani, Cecive, Belmonte, Galpón.*

Esto es esa visión única: bolsas por lote y por ubicación. No es otra solapa de Excel. Es el saldo. Si Dos Pancani dice 400 del lote 241 Agata, el sistema no va a dejar sacar 600.

**IA con oficio (40 s)** — *pegar o dictar la frase 1 → Interpretar → Confirmar.*

El operario no carga diez campos. Habla como en el galpón: «Pasá 80 bolsas del lote 241 Agata de Dos Pancani al galpón.» El sistema arma lote, cantidad, origen y destino, sin API paga. Nosotros confirmamos. Pancani baja, el galpón sube, queda el historial. Una sola fuente de verdad.

**La regla que Excel no tenía (40 s)** — *frase 2 → Interpretar → Confirmar.*

Ahora el caso que duele: «Retirá 600 del 241 de Pancani.» En Pancani no hay 600. El movimiento se rechaza y el mensaje dice exactamente cuántas bolsas hay. Eso es lo que hoy se descubre con el cliente esperando.

**Cierre (20 s)**

Carga en el lenguaje del operario, validación de stock, listo para sumar otro frío o clientes sin rehacer el motor de movimientos. Sin planilla.

---

## Si cortan a 60 segundos

Cuatro depósitos, una planilla, el error llega en la entrega. Acá hay un saldo único. Movemos 80 bolsas con una frase. Pedimos 600 y el sistema dice que no. Eso es el producto.

---

## Si el micrófono falla

Seguí el mismo guión pegando las frases. No improvisar un formulario: el punto es el lenguaje libre más la validación.
