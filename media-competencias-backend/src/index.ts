import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';

// 1. Elimina catalogRoutes e importa tu nueva ruta de eventos
import eventosRoutes from './routes/eventRoutes'; 
import orderRoutes from './routes/orderRoutes';
import paymentRoutes from './routes/paymentRoutes';
import participantRoutes from './routes/participantRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 2. Registra la nueva ruta asegurándote de usar el prefijo /api/v1/eventos
app.use('/api/v1/eventos', eventosRoutes); 

app.use('/api/v1', orderRoutes);
app.use('/api/v1', paymentRoutes);

app.use('/api/v1/participantes', participantRoutes);

// Endpoint de prueba de salud
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      message: 'Servidor corriendo y conectado a PostgreSQL',
      dbTime: dbCheck.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error al conectar con la base de datos',
      error: error instanceof Error ? error.message : error
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});