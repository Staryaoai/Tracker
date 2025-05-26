import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL);

export async function GET(request) {
  try {
    // 创建 categories 表
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `;
    console.log('Categories table created or already exists.');

    // 创建 learning_records 表
    await sql`
      CREATE TABLE IF NOT EXISTS learning_records (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log('Learning records table created or already exists.');

    return NextResponse.json({ message: '数据库表创建成功 (或已存在)!' });

  } catch (error) {
    console.error('创建数据库表失败:', error);
    return NextResponse.json(
      { message: '创建数据库表失败', error: error.message },
      { status: 500 }
    );
  }
}