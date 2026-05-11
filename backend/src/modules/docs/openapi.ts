export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ISTL Asistencia Virtual Docente API',
    version: '1.0.0',
    description: 'API REST para autenticacion, horarios, asistencia docente y reportes del ISTL.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Desarrollo local',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Autenticacion y sesion' },
    { name: 'Horarios', description: 'Gestion y consulta de horarios academicos' },
    { name: 'Asistencias', description: 'Registro de entrada/salida docente' },
    { name: 'Reportes', description: 'Resumenes y exportaciones' },
    { name: 'Sistema', description: 'Salud y documentacion' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: false },
          message: { type: 'string' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'docente@tecnologicoloja.edu.ec' },
          password: { type: 'string', example: 'Password123' },
        },
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          nombre: { type: 'string' },
          apellido: { type: 'string' },
          rol: { type: 'string', enum: ['docente', 'coordinador', 'tics', 'rectorado'] },
          avatar_url: { type: 'string', nullable: true },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      HorarioRequest: {
        type: 'object',
        required: ['materia_id', 'dia_semana', 'hora_inicio', 'hora_fin', 'ciclo', 'fecha_inicio_ciclo', 'fecha_fin_ciclo'],
        properties: {
          materia_id: { type: 'string', format: 'uuid' },
          dia_semana: { type: 'string', enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] },
          hora_inicio: { type: 'string', example: '08:00' },
          hora_fin: { type: 'string', example: '10:00' },
          ciclo: { type: 'string', example: '2026-I' },
          modalidad: { type: 'string', enum: ['virtual', 'presencial', 'hibrida'], default: 'virtual' },
          url_aula_virtual: { type: 'string', format: 'uri' },
          activo: { type: 'boolean', default: true },
          fecha_inicio_ciclo: { type: 'string', format: 'date' },
          fecha_fin_ciclo: { type: 'string', format: 'date' },
        },
      },
      LocationRequest: {
        type: 'object',
        properties: {
          lat: { type: 'number', example: -3.9931 },
          lng: { type: 'number', example: -79.2042 },
          precision_m: { type: 'integer', example: 25 },
        },
      },
      ReportSummary: {
        type: 'object',
        properties: {
          totalProgramadas: { type: 'integer' },
          totalRegistros: { type: 'integer' },
          presentes: { type: 'integer' },
          puntual: { type: 'integer' },
          tardanza: { type: 'integer' },
          ausente: { type: 'integer' },
          justificado: { type: 'integer' },
          registros: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Health check del backend',
        responses: {
          '200': {
            description: 'Servicio disponible',
          },
        },
      },
    },
    '/api/openapi.json': {
      get: {
        tags: ['Sistema'],
        summary: 'Especificacion OpenAPI en JSON',
        responses: {
          '200': { description: 'Documento OpenAPI 3.0' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesion',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          '200': { description: 'Login exitoso' },
          '401': { description: 'Credenciales invalidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'Tokens renovados' } },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesion',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Sesion cerrada' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Obtener perfil autenticado',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Perfil del usuario' } },
      },
    },
    '/api/v1/auth/change-password': {
      put: {
        tags: ['Auth'],
        summary: 'Cambiar contrasena',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Contrasena actualizada' } },
      },
    },
    '/api/v1/horarios': {
      get: {
        tags: ['Horarios'],
        summary: 'Listar horarios segun rol y filtros',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'materia_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'docente_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'carrera_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'dia_semana', in: 'query', schema: { type: 'string' } },
          { name: 'ciclo', in: 'query', schema: { type: 'string' } },
          { name: 'modalidad', in: 'query', schema: { type: 'string' } },
          { name: 'activo', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Listado de horarios' } },
      },
      post: {
        tags: ['Horarios'],
        summary: 'Crear horario',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HorarioRequest' } } },
        },
        responses: { '201': { description: 'Horario creado' } },
      },
    },
    '/api/v1/horarios/{id}': {
      get: {
        tags: ['Horarios'],
        summary: 'Obtener detalle de horario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Detalle de horario' } },
      },
      put: {
        tags: ['Horarios'],
        summary: 'Actualizar horario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/HorarioRequest' } } } },
        responses: { '200': { description: 'Horario actualizado' } },
      },
      delete: {
        tags: ['Horarios'],
        summary: 'Desactivar horario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Horario desactivado' } },
      },
    },
    '/api/v1/asistencias': {
      get: {
        tags: ['Asistencias'],
        summary: 'Listar registros de asistencia segun rol',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'docente_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'horario_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'estado', in: 'query', schema: { type: 'string', enum: ['puntual', 'tardanza', 'ausente', 'justificado'] } },
          { name: 'fecha_inicio', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'fecha_fin', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Registros de asistencia' } },
      },
    },
    '/api/v1/asistencias/estado-actual': {
      get: {
        tags: ['Asistencias'],
        summary: 'Clase activa y registro abierto del docente',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Estado actual de asistencia' } },
      },
    },
    '/api/v1/asistencias/entrada': {
      post: {
        tags: ['Asistencias'],
        summary: 'Marcar ingreso',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationRequest' } } } },
        responses: { '201': { description: 'Ingreso registrado' } },
      },
    },
    '/api/v1/asistencias/salida': {
      post: {
        tags: ['Asistencias'],
        summary: 'Marcar salida',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationRequest' } } } },
        responses: { '200': { description: 'Salida registrada' } },
      },
    },
    '/api/v1/reportes/resumen': {
      get: {
        tags: ['Reportes'],
        summary: 'Resumen estadistico de asistencias',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'fecha_inicio', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'fecha_fin', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'carrera_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'docente_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'ciclo', in: 'query', schema: { type: 'string' } },
          { name: 'estado', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Resumen de asistencias' } },
      },
    },
    '/api/v1/reportes/pdf': {
      get: {
        tags: ['Reportes'],
        summary: 'Descargar reporte PDF',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Archivo PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } } },
      },
    },
    '/api/v1/reportes/excel': {
      get: {
        tags: ['Reportes'],
        summary: 'Descargar reporte Excel',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Archivo Excel',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
        },
      },
    },
  },
} as const;
