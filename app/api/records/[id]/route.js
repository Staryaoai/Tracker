import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL);

// 处理 GET 请求: 根据 ID 获取单条学习记录
export async function GET(request, context) { // Changed to 'context' to await context.params
  // Next.js 提示 params 可能需要 await (虽然不常见，我们先获取整个 context)
  // 通常我们直接用 const { params } = context;
  // 但为了应对警告，我们尝试先让 context 准备好。
  // 不过，通常 params 是 context 的一个同步属性。
  // 我们将直接使用 context.params.id
  
  let recordId;
  try {
    // 确保 params 对象和 id 属性存在
    if (!context || !context.params || typeof context.params.id === 'undefined') {
        console.error('Error: params or params.id is undefined. Context:', context);
        return NextResponse.json({ message: '请求参数错误，无法获取记录ID' }, { status: 400 });
    }
    recordId = parseInt(context.params.id, 10);
  } catch (e) {
    console.error('Error parsing recordId:', e, 'Context params:', context ? context.params : 'context undefined');
    return NextResponse.json({ message: '记录ID解析失败' }, { status: 400 });
  }


  if (isNaN(recordId)) {
    return NextResponse.json({ message: '记录ID无效' }, { status: 400 });
  }

  try {
    // sql.query() 直接返回行数组
    const recordsArray = await sql.query(
      `SELECT lr.id, lr.title, lr.content, lr.created_at, lr.category_id, c.name AS category_name 
       FROM learning_records lr
       LEFT JOIN categories c ON lr.category_id = c.id
       WHERE lr.id = $1;`,
      [recordId]
    );

    // 调试日志，查看 sql.query 的实际返回值
    console.log(`Query result for ID ${recordId}:`, recordsArray);
    console.log(`Is recordsArray an array? : ${Array.isArray(recordsArray)}`);


    if (!recordsArray || recordsArray.length === 0) { // 直接检查数组及其长度
      return NextResponse.json({ message: '未找到指定的学习记录' }, { status: 404 });
    }

    return NextResponse.json(recordsArray[0]); // 返回数组的第一个元素
  } catch (error) {
    console.error(`获取记录ID ${recordId} 失败:`, error, error.stack);
    return NextResponse.json(
      { message: '获取学习记录失败', error: error.message },
      { status: 500 }
    );
  }
}

// 我们稍后会在这里添加 PUT 方法用于更新记录
// (Existing GET function is above this)

// Handle PUT requests: Update an existing learning record by ID
export async function PUT(request, context) {
  let recordId;
  try {
    if (!context || !context.params || typeof context.params.id === 'undefined') {
      return NextResponse.json({ message: '请求参数错误，无法获取记录ID' }, { status: 400 });
    }
    recordId = parseInt(context.params.id, 10);
  } catch (e) {
    return NextResponse.json({ message: '记录ID解析失败' }, { status: 400 });
  }

  if (isNaN(recordId)) {
    return NextResponse.json({ message: '记录ID无效' }, { status: 400 });
  }

  try {
    const { title, content, category_id } = await request.json();

    if (!title || title.trim() === '') {
      return NextResponse.json({ message: '标题不能为空' }, { status: 400 });
    }

    // Construct the UPDATE query
    // We only update fields that are provided.
    // For category_id, if it's explicitly passed as null, we set it to null.
    // If it's undefined, we don't update it (unless we want to always set it).
    // For simplicity here, we assume title is always provided.
    // Content and category_id can be updated.

    const updateFields = [];
    const queryParams = [];
    let paramIndex = 1;

    updateFields.push(`title = $${paramIndex++}`);
    queryParams.push(title.trim());

    // Check if content is provided in the request body to update it
    if (typeof content !== 'undefined') {
      updateFields.push(`content = $${paramIndex++}`);
      queryParams.push(content === null ? null : content.trim());
    }

    // Check if category_id is provided in the request body to update it
    // category_id can be a number or null.
    if (typeof category_id !== 'undefined') {
      updateFields.push(`category_id = $${paramIndex++}`);
      queryParams.push(category_id === null ? null : parseInt(category_id, 10));
    }
    
    // Add the recordId as the last parameter for the WHERE clause
    queryParams.push(recordId);

    if (updateFields.length === 0) {
        // This case should ideally not happen if title is always sent and required
        return NextResponse.json({ message: '没有提供要更新的字段' }, { status: 400 });
    }

    const updateQuery = `
      UPDATE learning_records
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, title, content, category_id, created_at; 
    `;
    // Note: RETURNING will also need a JOIN if we want category_name directly.
    // For simplicity, we return the raw updated record first.

    console.log('Executing UPDATE query:', updateQuery);
    console.log('With parameters:', queryParams);

    const result = await sql.query(updateQuery, queryParams);

    if (result.rowCount === 0) { // Or check result.rows.length if it returns rows
      return NextResponse.json({ message: '未找到要更新的记录，或记录未被修改' }, { status: 404 });
    }
    
    // Fetch the updated record with category name to return it
    const updatedRecordWithCategory = await sql.query(
        `SELECT lr.id, lr.title, lr.content, lr.created_at, lr.category_id, c.name AS category_name 
         FROM learning_records lr
         LEFT JOIN categories c ON lr.category_id = c.id
         WHERE lr.id = $1;`,
        [recordId]
      );

    return NextResponse.json(updatedRecordWithCategory[0]); // Assuming sql.query returns array of rows

  } catch (error) {
    console.error(`更新记录ID ${recordId} 失败:`, error, error.stack);
    // Check for foreign key constraint error for category_id
    if (error.message && error.message.includes('violates foreign key constraint')) {
        return NextResponse.json({ message: '提供的 category_id 无效' }, { status: 400 });
    }
    return NextResponse.json(
      { message: '更新学习记录失败', error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, context) {
  let recordId;
  try {
    if (!context || !context.params || typeof context.params.id === 'undefined') {
      return NextResponse.json({ message: '请求参数错误，无法获取记录ID' }, { status: 400 });
    }
    recordId = parseInt(context.params.id, 10);
  } catch (e) {
    return NextResponse.json({ message: '记录ID解析失败' }, { status: 400 });
  }

  if (isNaN(recordId)) {
    return NextResponse.json({ message: '记录ID无效' }, { status: 400 });
  }
  try {
    const result = await sql.query(
      `DELETE FROM learning_records WHERE id = $1 RETURNING id, title;`, // RETURNING id and title to get the deleted record info
      [recordId]
    );

    // The 'result' object from sql.query for DELETE usually contains 'rowCount'.
    // If using `postgres.js` (which @neondatabase/serverless might wrap or be similar to),
    // a DELETE query returns an array of the deleted rows if RETURNING is used,
    // or an object with rowCount. Let's check rowCount.
    // If `result` is an array from RETURNING, its length would indicate rows affected.
    // If `result` is an object like {rowCount: 1}, we use that.
    // Based on previous experience with sql.query directly returning arrays for SELECT,
    // it might return an array for RETURNING as well.

    let deletedCount = 0;
    let deletedRecord = null;
    if (Array.isArray(result)) {
        deletedCount = result.length;
        deletedRecord = result[0]; // Get the first (and should be only) deleted record
    } else if (result && typeof result.rowCount !== 'undefined') {
        deletedCount = result.rowCount;
    }

    console.log(`Deletion result for ID ${recordId}:`, result, `Deleted count: ${deletedCount}`);

    if (deletedCount === 0) {
      return NextResponse.json({ message: '未找到要删除的记录，或记录未被删除' }, { status: 404 });
    }

    // Use the record title in the success message
    const recordTitle = deletedRecord && deletedRecord.title ? deletedRecord.title : `ID ${recordId}`;
    return NextResponse.json({ message: `记录 (${recordTitle}) 已成功删除` }); // Or return status 204 No Content
  } catch (error) {
    console.error(`删除记录ID ${recordId} 失败:`, error, error.stack);
    return NextResponse.json(
      { message: '删除学习记录失败', error: error.message },
      { status: 500 }
    );
  }
}