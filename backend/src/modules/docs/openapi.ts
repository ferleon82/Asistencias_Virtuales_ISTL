const authResponse = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', example: true },
    message: { type: 'string', example: 'Operacion realizada correctamente.' },
    data: { type: 'object' },
  },
};

const bearerErrorResponses = {
  '401': {
    description: 'Token ausente o inválido',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
  },
  '403': {
    description: 'Usuario sin permisos para ejecutar la accion',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
  },
};

const reporteParameters = [
  { name: 'fecha_inicio', in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'fecha_fin', in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'carrera_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
  { name: 'materia_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
  { name: 'docente_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
  { name: 'ciclo', in: 'query', schema: { type: 'string', example: '2026-I' } },
  { name: 'estado', in: 'query', schema: { $ref: '#/components/schemas/EstadoAsistencia' } },
];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'ISTL Asistencia Virtual Docente API',
    version: '1.0.0',
    description:
      'API REST para autenticación institucional, horarios, asistencia docente, geolocalización y reportes del ISTL.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Desarrollo local',
    },
  ],
  tags: [
    { name: 'Auth', description: 'Autenticación, sesión y Google OAuth institucional' },
    { name: 'Horarios', description: 'Gestión y consulta de horarios académicos' },
    { name: 'Asistencias', description: 'Registro de entrada/salida, GPS y justificaciones' },
    { name: 'Reportes', description: 'Resumenes y exportaciones PDF/Excel' },
    { name: 'Admin', description: 'Administración de usuarios, carreras, materias y docentes' },
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
          message: { type: 'string', example: 'Autenticación requerida.' },
        },
      },
      EstadoAsistencia: {
        type: 'string',
        enum: ['puntual', 'tardanza', 'ausente', 'justificado'],
      },
      Rol: {
        type: 'string',
        enum: ['docente', 'coordinador', 'tics', 'rectorado', 'talento_humano'],
      },
      DiaSemana: {
        type: 'string',
        enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
      },
      Modalidad: {
        type: 'string',
        enum: ['virtual', 'presencial', 'hibrida'],
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'docente@tecnologicoloja.edu.ec' },
          password: { type: 'string', example: 'Password123' },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string', example: 'Password123' },
          newPassword: { type: 'string', example: 'NuevaClave123' },
        },
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          nombre: { type: 'string' },
          apellido: { type: 'string' },
          rol: { $ref: '#/components/schemas/Rol' },
          avatar_url: { type: 'string', nullable: true },
          activo: { type: 'boolean' },
        },
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/AuthUser' },
              tokens: { $ref: '#/components/schemas/TokenPair' },
            },
          },
        },
      },
      HorarioRequest: {
        type: 'object',
        required: ['materia_id', 'dia_semana', 'hora_inicio', 'hora_fin', 'ciclo', 'fecha_inicio_ciclo', 'fecha_fin_ciclo'],
        properties: {
          materia_id: { type: 'string', format: 'uuid' },
          dia_semana: { $ref: '#/components/schemas/DiaSemana' },
          hora_inicio: { type: 'string', example: '08:00' },
          hora_fin: { type: 'string', example: '10:00' },
          ciclo: { type: 'string', example: '2026-I' },
          modalidad: { $ref: '#/components/schemas/Modalidad' },
          url_aula_virtual: { type: 'string', format: 'uri', nullable: true },
          activo: { type: 'boolean', default: true },
          fecha_inicio_ciclo: { type: 'string', format: 'date' },
          fecha_fin_ciclo: { type: 'string', format: 'date' },
        },
      },
      LocationRequest: {
        type: 'object',
        description: 'Geolocalizacion opcional enviada por el navegador al marcar asistencia.',
        properties: {
          lat: { type: 'number', nullable: true, example: -3.99781368 },
          lng: { type: 'number', nullable: true, example: -79.19759142 },
          precision_m: { type: 'integer', nullable: true, example: 97 },
        },
      },
      AttendanceRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          docente_id: { type: 'string', format: 'uuid' },
          horario_id: { type: 'string', format: 'uuid' },
          timestamp_entrada: { type: 'string', format: 'date-time', nullable: true },
          timestamp_salida: { type: 'string', format: 'date-time', nullable: true },
          ip_entrada: { type: 'string', nullable: true },
          ip_salida: { type: 'string', nullable: true },
          lat: { type: 'number', nullable: true },
          lng: { type: 'number', nullable: true },
          precision_m: { type: 'integer', nullable: true },
          estado: { $ref: '#/components/schemas/EstadoAsistencia' },
          justificacion: { type: 'string', nullable: true },
          docente: { $ref: '#/components/schemas/AuthUser' },
          horario: { type: 'object' },
        },
      },
      EstadoActualAsistencia: {
        type: 'object',
        properties: {
          horarioActivo: { type: 'object', nullable: true },
          registroAbierto: { $ref: '#/components/schemas/AttendanceRecord' },
          puedeMarcarEntrada: { type: 'boolean' },
          puedeMarcarSalida: { type: 'boolean' },
          salidaDisponibleDesde: { type: 'string', format: 'date-time', nullable: true },
          salidaBloqueadaMotivo: {
            type: 'string',
            nullable: true,
            example: 'La salida se habilita 10 minutos antes de la hora de fin de la clase.',
          },
        },
      },
      JustificacionRequest: {
        type: 'object',
        required: ['justificacion'],
        properties: {
          justificacion: {
            type: 'string',
            minLength: 10,
            maxLength: 500,
            example: 'Problemas de conectividad documentados durante la clase.',
          },
        },
      },
      ReportRow: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          docente: { type: 'string' },
          email: { type: 'string', format: 'email' },
          carrera: { type: 'string' },
          materia: { type: 'string' },
          ciclo: { type: 'string' },
          dia: { $ref: '#/components/schemas/DiaSemana' },
          horario: { type: 'string', example: '08:00 - 10:00' },
          entrada: { type: 'string', example: '12/5/26, 7:34 p. m.' },
          salida: { type: 'string', example: '12/5/26, 7:43 p. m.' },
          estado: { $ref: '#/components/schemas/EstadoAsistencia' },
          justificacion: { type: 'string' },
          ip_entrada: { type: 'string' },
          lat: { type: 'number', nullable: true },
          lng: { type: 'number', nullable: true },
          precision_m: { type: 'integer', nullable: true },
        },
      },
      ReportSummary: {
        type: 'object',
        properties: {
          periodo: {
            type: 'object',
            properties: {
              fecha_inicio: { type: 'string', format: 'date-time' },
              fecha_fin: { type: 'string', format: 'date-time' },
            },
          },
          totalProgramadas: { type: 'integer' },
          totalRegistros: { type: 'integer' },
          presentes: { type: 'integer' },
          puntual: { type: 'integer' },
          tardanza: { type: 'integer' },
          ausente: { type: 'integer' },
          justificado: { type: 'integer' },
          registros: { type: 'array', items: { $ref: '#/components/schemas/ReportRow' } },
          porCarrera: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                carrera: { type: 'string' },
                codigo: { type: 'string' },
                programadas: { type: 'integer' },
                registros: { type: 'integer' },
                presentes: { type: 'integer' },
                puntual: { type: 'integer' },
                tardanza: { type: 'integer' },
                ausente: { type: 'integer' },
                justificado: { type: 'integer' },
              },
            },
          },
          porPeriodo: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                periodo: { type: 'string' },
                programadas: { type: 'integer' },
                registros: { type: 'integer' },
                presentes: { type: 'integer' },
                puntual: { type: 'integer' },
                tardanza: { type: 'integer' },
                ausente: { type: 'integer' },
                justificado: { type: 'integer' },
              },
            },
          },
        },
      },
      CarreraRequest: {
        type: 'object',
        required: ['nombre', 'codigo'],
        properties: {
          nombre: { type: 'string', example: 'Desarrollo de Software' },
          codigo: { type: 'string', example: 'DSW' },
          coordinador_id: { type: 'string', format: 'uuid', nullable: true },
          activa: { type: 'boolean', default: true },
        },
      },
      MateriaRequest: {
        type: 'object',
        required: ['nombre', 'codigo', 'carrera_id'],
        properties: {
          nombre: { type: 'string', example: 'Base de Datos' },
          codigo: { type: 'string', example: 'BD' },
          carrera_id: { type: 'string', format: 'uuid' },
          docente_id: { type: 'string', format: 'uuid', nullable: true },
          creditos: { type: 'integer', minimum: 1, maximum: 12, default: 3 },
          activa: { type: 'boolean', default: true },
        },
      },
      UsuarioRequest: {
        type: 'object',
        required: ['email', 'nombre', 'apellido', 'cedula', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'usuario@tecnologicoloja.edu.ec' },
          nombre: { type: 'string' },
          apellido: { type: 'string' },
          cedula: { type: 'string' },
          password: { type: 'string', example: 'Password123' },
          rol: { $ref: '#/components/schemas/Rol' },
          telefono: { type: 'string', nullable: true },
          activo: { type: 'boolean', default: true },
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
          '200': { description: 'Servicio disponible' },
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
        summary: 'Iniciar sesión con correo y contraseña',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': {
            description: 'Login exitoso',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
          },
          '400': { description: 'Payload inválido', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          '401': { description: 'Credenciales inválidas', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
          '429': { description: 'Demasiados intentos de login' },
        },
      },
    },
    '/api/v1/auth/google': {
      get: {
        tags: ['Auth'],
        summary: 'Iniciar sesión con Google institucional',
        description:
          'Redirige al flujo OAuth de Google. Requiere GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL y GOOGLE_ALLOWED_DOMAIN.',
        responses: {
          '302': { description: 'Redireccion a Google OAuth o al login con mensaje de error' },
        },
      },
    },
    '/api/v1/auth/google/callback': {
      get: {
        tags: ['Auth'],
        summary: 'Callback OAuth de Google',
        description:
          'Valida el codigo OAuth, exige correo institucional verificado y redirige al frontend con accessToken y refreshToken en el fragmento URL.',
        parameters: [
          { name: 'code', in: 'query', schema: { type: 'string' } },
          { name: 'state', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '302': { description: 'Redireccion al frontend con tokens o error' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar tokens',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
        },
        responses: {
          '200': { description: 'Tokens renovados', content: { 'application/json': { schema: authResponse } } },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
        },
        responses: {
          '200': { description: 'Sesión cerrada' },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Obtener perfil autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Perfil del usuario', content: { 'application/json': { schema: authResponse } } },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/auth/change-password': {
      put: {
        tags: ['Auth'],
        summary: 'Cambiar contraseña',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChangePasswordRequest' } } },
        },
        responses: {
          '200': { description: 'Contraseña actualizada' },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/horarios': {
      get: {
        tags: ['Horarios'],
        summary: 'Listar horarios según rol y filtros',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'materia_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'docente_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'carrera_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'dia_semana', in: 'query', schema: { $ref: '#/components/schemas/DiaSemana' } },
          { name: 'ciclo', in: 'query', schema: { type: 'string' } },
          { name: 'modalidad', in: 'query', schema: { $ref: '#/components/schemas/Modalidad' } },
          { name: 'activo', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Listado de horarios' }, ...bearerErrorResponses },
      },
      post: {
        tags: ['Horarios'],
        summary: 'Crear horario',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/HorarioRequest' } } },
        },
        responses: { '201': { description: 'Horario creado' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/horarios/{id}': {
      get: {
        tags: ['Horarios'],
        summary: 'Obtener detalle de horario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Detalle de horario' }, ...bearerErrorResponses },
      },
      put: {
        tags: ['Horarios'],
        summary: 'Actualizar horario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/HorarioRequest' } } } },
        responses: { '200': { description: 'Horario actualizado' }, ...bearerErrorResponses },
      },
      delete: {
        tags: ['Horarios'],
        summary: 'Desactivar horario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Horario desactivado' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/asistencias': {
      get: {
        tags: ['Asistencias'],
        summary: 'Listar registros de asistencia según rol',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'docente_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'horario_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'estado', in: 'query', schema: { $ref: '#/components/schemas/EstadoAsistencia' } },
          { name: 'fecha_inicio', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'fecha_fin', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'Registros de asistencia',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/AttendanceRecord' } },
                  },
                },
              },
            },
          },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/asistencias/estado-actual': {
      get: {
        tags: ['Asistencias'],
        summary: 'Clase activa, registro abierto y permisos de marcación del docente',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Estado actual de asistencia',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/EstadoActualAsistencia' },
                  },
                },
              },
            },
          },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/asistencias/entrada': {
      post: {
        tags: ['Asistencias'],
        summary: 'Marcar ingreso con geolocalización opcional',
        description:
          'Solo docentes. Rechaza duplicados, clases fuera de ventana y registros abiertos pendientes de salida.',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationRequest' } } } },
        responses: {
          '201': { description: 'Ingreso registrado' },
          '400': { description: 'Clase fuera de la ventana permitida' },
          '404': { description: 'No hay clase activa' },
          '409': { description: 'Ya existe asistencia abierta o clase ya registrada' },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/asistencias/salida': {
      post: {
        tags: ['Asistencias'],
        summary: 'Marcar salida con geolocalización opcional',
        description: 'Solo docentes. La salida se habilita 10 minutos antes de la hora fin configurada.',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationRequest' } } } },
        responses: {
          '200': { description: 'Salida registrada' },
          '400': { description: 'Salida aun bloqueada por ventana horaria' },
          '404': { description: 'No hay asistencia abierta' },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/asistencias/{id}/justificacion': {
      post: {
        tags: ['Asistencias'],
        summary: 'Solicitar justificación de asistencia',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/JustificacionRequest' } } },
        },
        responses: { '200': { description: 'Justificación enviada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/asistencias/{id}/justificacion/aprobar': {
      post: {
        tags: ['Asistencias'],
        summary: 'Aprobar justificación',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Justificación aprobada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/asistencias/{id}/justificacion/rechazar': {
      post: {
        tags: ['Asistencias'],
        summary: 'Rechazar justificación',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Justificación rechazada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/reportes/resumen': {
      get: {
        tags: ['Reportes'],
        summary: 'Resumen estadistico de asistencias',
        security: [{ bearerAuth: [] }],
        parameters: reporteParameters,
        responses: {
          '200': {
            description: 'Resumen de asistencias',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/ReportSummary' },
                  },
                },
              },
            },
          },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/reportes/pdf': {
      get: {
        tags: ['Reportes'],
        summary: 'Descargar reporte PDF institucional',
        security: [{ bearerAuth: [] }],
        parameters: reporteParameters,
        responses: {
          '200': { description: 'Archivo PDF', content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/reportes/excel': {
      get: {
        tags: ['Reportes'],
        summary: 'Descargar reporte Excel',
        security: [{ bearerAuth: [] }],
        parameters: reporteParameters,
        responses: {
          '200': {
            description: 'Archivo Excel',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          ...bearerErrorResponses,
        },
      },
    },
    '/api/v1/admin/usuarios': {
      get: {
        tags: ['Admin'],
        summary: 'Listar usuarios institucionales',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de usuarios' }, ...bearerErrorResponses },
      },
      post: {
        tags: ['Admin'],
        summary: 'Crear usuario institucional',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UsuarioRequest' } } } },
        responses: { '201': { description: 'Usuario creado' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/admin/usuarios/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Actualizar usuario institucional',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/UsuarioRequest' } } } },
        responses: { '200': { description: 'Usuario actualizado' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/admin/carreras': {
      get: {
        tags: ['Admin'],
        summary: 'Listar carreras',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de carreras' }, ...bearerErrorResponses },
      },
      post: {
        tags: ['Admin'],
        summary: 'Crear carrera',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CarreraRequest' } } } },
        responses: { '201': { description: 'Carrera creada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/admin/carreras/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Actualizar carrera',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CarreraRequest' } } } },
        responses: { '200': { description: 'Carrera actualizada' }, ...bearerErrorResponses },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Desactivar carrera',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Carrera desactivada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/admin/materias': {
      get: {
        tags: ['Admin'],
        summary: 'Listar materias',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de materias' }, ...bearerErrorResponses },
      },
      post: {
        tags: ['Admin'],
        summary: 'Crear materia',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MateriaRequest' } } } },
        responses: { '201': { description: 'Materia creada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/admin/materias/{id}': {
      put: {
        tags: ['Admin'],
        summary: 'Actualizar materia',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/MateriaRequest' } } } },
        responses: { '200': { description: 'Materia actualizada' }, ...bearerErrorResponses },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Desactivar materia',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Materia desactivada' }, ...bearerErrorResponses },
      },
    },
    '/api/v1/admin/docentes': {
      get: {
        tags: ['Admin'],
        summary: 'Listar docentes activos',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Listado de docentes' }, ...bearerErrorResponses },
      },
    },
  },
} as const;
