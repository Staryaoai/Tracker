import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL);
const DEFAULT_RECORDS_LIMIT = 10; // Let's use 10 for easier testing of pagination

export async function GET(request) {
  const requestUrl = request.url;
  console.log(`[API /api/records GET] Received request: ${requestUrl}`);

  try {
    const { searchParams } = new URL(requestUrl);
    let page = parseInt(searchParams.get('page') || '1', 10);
    let limit = parseInt(searchParams.get('limit') || DEFAULT_RECORDS_LIMIT.toString(), 10);
    const categoryIdParam = searchParams.get('categoryId'); // Get categoryId from query

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = DEFAULT_RECORDS_LIMIT;

    const offset = (page - 1) * limit;

    let whereClauses = [];
    const queryParams = []; // Parameters for the WHERE clauses (e.g., categoryId)
    let paramIndex = 1;

    // Add categoryId filter if present and valid
    if (categoryIdParam) {
      const categoryId = parseInt(categoryIdParam, 10);
      if (!isNaN(categoryId)) {
        whereClauses.push(`lr.category_id = $${paramIndex++}`);
        queryParams.push(categoryId);
        console.log(`[API /api/records GET] Filtering by categoryId: ${categoryId}`);
      } else {
        console.warn(`[API /api/records GET] Invalid categoryId parameter received: ${categoryIdParam}`);
      }
    }

    const whereCondition = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const recordsQueryString = `
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
      ${whereCondition}
      ORDER BY
        lr.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}; 
    `;
    const recordsParamsFinal = [...queryParams, limit, offset]; // Combine filter params with pagination params

    const countQueryString = `
      SELECT COUNT(lr.id) AS total_count 
      FROM learning_records lr
      ${whereCondition};
    `;
    const countParamsFinal = [...queryParams]; // Only filter params for count

    console.log(`[API /api/records GET] Executing records query: ${recordsQueryString.replace(/\s+/g, ' ').trim()} with params:`, recordsParamsFinal);
    const fetchedRecords = await sql.query(recordsQueryString, recordsParamsFinal);

    console.log(`[API /api/records GET] Executing count query: ${countQueryString.replace(/\s+/g, ' ').trim()} with params:`, countParamsFinal);
    const totalCountResult = await sql.query(countQueryString, countParamsFinal);

    let totalRecords = 0;
    if (totalCountResult && totalCountResult.length > 0 && totalCountResult[0].total_count !== undefined) {
      totalRecords = parseInt(totalCountResult[0].total_count, 10);
    } else {
      console.error(`[API /api/records GET] Failed to retrieve total_count. totalCountResult:`, totalCountResult);
    }

    console.log(`[API /api/records GET] Responding with ${fetchedRecords.length} records for page ${page}. Total records matching filter: ${totalRecords}. Limit: ${limit}`);
    return NextResponse.json({
      records: fetchedRecords,
      totalRecords,
      currentPage: page,
      totalPages: Math.ceil(totalRecords / limit),
      limit: limit
    });

  } catch (error) {
    console.error('[API /api/records GET] Critical error fetching paginated records:', error, error.stack);
    return NextResponse.json(
      { message: '获取学习记录失败 (分页)', error: error.message },
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