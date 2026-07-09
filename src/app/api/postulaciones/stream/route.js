/**
 * GET /api/postulaciones/stream
 * Server-Sent Events: el cliente se suscribe y recibe actualizaciones en tiempo real
 * cada vez que se agrega/actualiza una postulación.
 */
import { registerSseClient } from '@/lib/postulacionesStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // Encoder para convertir strings a Uint8Array
      const encoder = new TextEncoder();

      // Crear un objeto "res" compatible con la firma de registerSseClient
      const sseRes = {
        write(chunk) {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // Stream cerrado
          }
        },
      };

      // Registrar cliente y obtener función de limpieza
      const cleanup = registerSseClient(sseRes);

      // Heartbeat cada 25s para mantener conexión viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Limpieza cuando el cliente se desconecta
      return () => {
        clearInterval(heartbeat);
        cleanup();
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
