import { env } from './config/env';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';

// Zona horaria del Ecuador
process.env.TZ = 'America/Guayaquil';

async function bootstrap(): Promise<void> {
  console.log('\n🏫 ISTL - Sistema de Asistencia Virtual Docente');
  console.log('━'.repeat(50));

  try {
    // Conectar servicios
    await connectDatabase();
    await connectRedis();

    // Crear y levantar servidor
    const app = createApp();

    const server = app.listen(env.PORT, () => {
      console.log(`\n🚀 Servidor iniciado en http://localhost:${env.PORT}`);
      console.log(`📋 Entorno: ${env.NODE_ENV}`);
      console.log(`🕐 Zona horaria: ${process.env.TZ}`);
      console.log(`\n📡 Endpoints disponibles:`);
      console.log(`   GET  /health`);
      console.log(`   POST /api/v1/auth/login`);
      console.log(`   POST /api/v1/auth/refresh`);
      console.log(`   POST /api/v1/auth/logout`);
      console.log(`   GET  /api/v1/auth/me`);
      console.log(`   PUT  /api/v1/auth/change-password`);
      console.log(`   GET  /api/v1/horarios`);
      console.log(`   POST /api/v1/horarios`);
      console.log(`   GET  /api/v1/asistencias/estado-actual`);
      console.log(`   POST /api/v1/asistencias/entrada`);
      console.log(`   POST /api/v1/asistencias/salida`);
      console.log(`   GET  /api/v1/reportes/resumen`);
      console.log(`   GET  /api/v1/reportes/pdf`);
      console.log(`   GET  /api/v1/reportes/excel`);
      console.log(`   GET  /api/docs`);
      console.log(`   GET  /api/openapi.json`);
      console.log('━'.repeat(50) + '\n');
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`\n⚠️  Señal ${signal} recibida. Cerrando servidor...`);
      server.close(async () => {
        await disconnectDatabase();
        await disconnectRedis();
        console.log('✅ Servidor cerrado correctamente.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

bootstrap();
