import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL);

// 处理 GET 请求: 获取所有标签
export async function GET() {
  try {
    const categories = await sql`SELECT * FROM categories ORDER BY name ASC;`;
    return NextResponse.json(categories);
  } catch (error) {
    console.error('获取标签失败:', error);
    return NextResponse.json(
      { message: '获取标签失败', error: error.message },
      { status: 500 }
    );
  }
}

// 处理 POST 请求: 创建新标签
export async function POST(request) {
  try {
    const { name } = await request.json(); // 从请求体中获取标签名称

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { message: '标签名称不能为空' },
        { status: 400 } // 400 Bad Request
      );
    }

    // 插入新标签并返回插入的数据
    // ON CONFLICT (name) DO NOTHING 会在名称已存在时阻止插入重复项，且不报错
    // 如果希望在冲突时返回已存在的项或特定消息，逻辑会更复杂一些
    const newCategory = await sql`
      INSERT INTO categories (name)
      VALUES (${name.trim()})
      ON CONFLICT (name) DO NOTHING
      RETURNING *;
    `;

    if (newCategory.length === 0) {
      // 这意味着名称已存在，并且我们设置了 ON CONFLICT DO NOTHING
      const existingCategory = await sql`SELECT * FROM categories WHERE name = ${name.trim()};`;
      return NextResponse.json(
        { message: '标签名称已存在', category: existingCategory[0] },
        { status: 409 } // 409 Conflict
      );
    }

    return NextResponse.json(newCategory[0], { status: 201 }); // 201 Created
  } catch (error) {
    console.error('创建标签失败:', error);
    // 检查是否是唯一约束冲突 (虽然上面已经处理了，但以防万一)
    if (error.message.includes('duplicate key value violates unique constraint')) {
      return NextResponse.json(
        { message: '标签名称已存在' },
        { status: 409 } // 409 Conflict
      );
    }
    return NextResponse.json(
      { message: '创建标签失败', error: error.message },
      { status: 500 }
    );
  }
}