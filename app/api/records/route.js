import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL);

// 处理 GET 请求: 获取所有学习记录 (包含分类名称)
export async function GET(request) {
  try {
    // 使用 LEFT JOIN 来连接 learning_records 和 categories 表
    // 即使记录没有分类 (category_id IS NULL)，也会被查询出来
    // c.name AS category_name 用于给分类名称一个别名
    const records = await sql`
      SELECT
        lr.id,
        lr.title,
        lr.content,
        lr.created_at,
        lr.category_id,
        c.name AS category_name
      FROM
        learning_records lr
      LEFT JOIN
        categories c ON lr.category_id = c.id
      ORDER BY
        lr.created_at DESC;
    `;
    return NextResponse.json(records);
  } catch (error) {
    console.error('获取学习记录失败:', error);
    return NextResponse.json(
      { message: '获取学习记录失败', error: error.message },
      { status: 500 }
    );
  }
}

// 处理 POST 请求: 创建新的学习记录
export async function POST(request) {
  try {
    const { title, content, category_id } = await request.json();

    if (!title || title.trim() === '') {
      return NextResponse.json(
        { message: '标题不能为空' },
        { status: 400 }
      );
    }

    // 注意: category_id 是可选的。如果前端没有提供 category_id，
    // 或者提供的是 null/undefined，数据库中的 category_id 列需要允许 NULL 值。
    // 我们在创建表结构时已经设置了 category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL，
    // 这默认允许 NULL 值。

    const newRecord = await sql`
      INSERT INTO learning_records (title, content, category_id)
      VALUES (${title.trim()}, ${content ? content.trim() : null}, ${category_id || null})
      RETURNING *;
    `;

    // 为了在返回时也包含 category_name，我们可以再做一次查询，但这会增加复杂性。
    // 通常，创建操作返回创建的原始对象即可。
    // 如果确实需要，可以基于 newRecord[0].id 再查一次带 JOIN 的数据。
    // 或者，如果 category_id 存在，从前端传递过来的数据中，前端可能已经知道 category_name。
    // 这里我们先返回创建的记录。

    return NextResponse.json(newRecord[0], { status: 201 });
  } catch (error) {
    console.error('创建学习记录失败:', error);
    // 可以添加更具体的错误检查，例如外键约束失败 (如果 category_id 指向一个不存在的 category)
    if (error.message.includes('foreign key constraint')) {
         return NextResponse.json(
            { message: '提供的 category_id 无效或不存在' },
            { status: 400 }
        );
    }
    return NextResponse.json(
      { message: '创建学习记录失败', error: error.message },
      { status: 500 }
    );
  }
}