import { DiaSemana, Modalidad, PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123';

function nowInEcuador(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
}

function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function currentDiaSemana(date: Date): DiaSemana {
  const map: Record<number, DiaSemana> = {
    1: DiaSemana.lunes,
    2: DiaSemana.martes,
    3: DiaSemana.miercoles,
    4: DiaSemana.jueves,
    5: DiaSemana.viernes,
    6: DiaSemana.sabado,
  };

  return map[date.getDay()] ?? DiaSemana.lunes;
}

function sameDayTimeEnd(start: Date): string {
  const end = addMinutes(start, 90);
  if (end.getDate() !== start.getDate()) {
    return '23:59';
  }
  return formatTime(end);
}

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: 'admin@tecnologicoloja.edu.ec' },
    update: {
      activo: true,
      rol: Rol.tics,
    },
    create: {
      email: 'admin@tecnologicoloja.edu.ec',
      nombre: 'Administrador',
      apellido: 'ISTL',
      cedula: '0000000000',
      password_hash: passwordHash,
      rol: Rol.tics,
      activo: true,
    },
  });

  const docente = await prisma.user.upsert({
    where: { email: 'docente@tecnologicoloja.edu.ec' },
    update: {
      activo: true,
      rol: Rol.docente,
      password_hash: passwordHash,
    },
    create: {
      email: 'docente@tecnologicoloja.edu.ec',
      nombre: 'Docente',
      apellido: 'Prueba',
      cedula: '1100000001',
      password_hash: passwordHash,
      rol: Rol.docente,
      activo: true,
    },
  });

  const carrera = await prisma.carrera.upsert({
    where: { codigo: 'DSW' },
    update: {},
    create: {
      nombre: 'Desarrollo de Software',
      codigo: 'DSW',
    },
  });

  const materia = await prisma.materia.upsert({
    where: { codigo: 'DSW-DEV-001' },
    update: {
      carrera_id: carrera.id,
      docente_id: docente.id,
      ciclo: 1,
      activa: true,
    },
    create: {
      nombre: 'Clase de Prueba de Asistencia',
      codigo: 'DSW-DEV-001',
      carrera_id: carrera.id,
      docente_id: docente.id,
      ciclo: 1,
      creditos: 3,
      activa: true,
    },
  });

  const now = nowInEcuador();
  const existingHorario = await prisma.horario.findFirst({
    where: {
      materia_id: materia.id,
      ciclo: 'DEV-2026',
    },
  });

  const horarioData = {
    materia_id: materia.id,
    dia_semana: currentDiaSemana(now),
    hora_inicio: formatTime(addMinutes(now, -5)),
    hora_fin: sameDayTimeEnd(now),
    ciclo: 'DEV-2026',
    modalidad: Modalidad.virtual,
    url_aula_virtual: 'https://aula-virtual.tecnologicoloja.edu.ec',
    activo: true,
    fecha_inicio_ciclo: addMinutes(now, -60 * 24 * 30),
    fecha_fin_ciclo: addMinutes(now, 60 * 24 * 30),
  };

  if (existingHorario) {
    await prisma.horario.update({
      where: { id: existingHorario.id },
      data: horarioData,
    });
  } else {
    await prisma.horario.create({ data: horarioData });
  }

  console.log('Seed completado.');
  console.log('Admin: admin@tecnologicoloja.edu.ec / Password123');
  console.log('Docente: docente@tecnologicoloja.edu.ec / Password123');
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
