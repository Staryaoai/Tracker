import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { format } from 'date-fns'; // We'll use date-fns for date formatting

const sql = neon(process.env.POSTGRES_URL);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate'); // e.g., YYYY-MM-DD
    const endDate = searchParams.get('endDate');     // e.g., YYYY-MM-DD

    let query = `
      SELECT
        title,
        content,
        created_at
      FROM
        learning_records
    `;

    const conditions = [];
    const queryParams = [];

    if (startDate) {
      // Ensure startDate is at the beginning of the day
      queryParams.push(`${startDate} 00:00:00`);
      conditions.push(`created_at >= $${queryParams.length}`);
    }
    if (endDate) {
      // Ensure endDate is at the end of the day
      queryParams.push(`${endDate} 23:59:59`);
      conditions.push(`created_at <= $${queryParams.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

      query += ` ORDER BY created_at ASC;`; // query is the full SQL string, queryParams is the array of values

      console.log('Executing query:', query);
      console.log('With parameters:', queryParams);

      // For a conventional function call with value placeholders ($1, $2, etc.), use sql.query()
      const queryResult = await sql.query(query, queryParams);
      const records = queryResult; // <--- CORRECTED: queryResult IS the array of records

      // 调试日志：查看 `records` 的结构和类型 AFTER execution
      console.log('Database execution queryResult (this is the records array):', queryResult);
      console.log('Assigned records for processing:', records);
      console.log('Is assigned records an array?', Array.isArray(records)); // This should now be true if records exist

      if (!records || records.length === 0) {
          return NextResponse.json({ message: '该时间范围内没有记录可导出' }, { status: 404 });
      }

      // 调试日志：查看 `records` 的结构和类型 AFTER execution
      console.log('Database execution result (records):', records);

      // 调试日志：查看 `records` 的结构和类型 AFTER execution
      console.log('Database execution result (records):', records);
      console.log('Type of records:', typeof records);
      console.log('Is records an array?', Array.isArray(records));

      // The `sql` tag for SELECT queries should directly return an array of records.
      // So, `records` should now be the array we expect.

      if (!records || records.length === 0) {
          return NextResponse.json({ message: '该时间范围内没有记录可导出' }, { status: 404 });
      }

      // Format records into Markdown
      let markdownContent = '# 学习记录导出\n\n';
      records.forEach(record => { // Now 'records' should be the actual array
          if (!record || !record.created_at) {
              console.warn('Skipping record due to missing created_at:', record);
              return;
          }
          const formattedTime = format(new Date(record.created_at), 'yyyy-MM-dd HH:mm:ss');
          markdownContent += `## ${formattedTime} - ${record.title}\n\n`;
          markdownContent += `${record.content || '没有内容'}\n\n---\n\n`;
      });

    // Return as plain text, frontend will handle file download
    return new NextResponse(markdownContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        // Instruct browser to download, filename based on date range or current date
        // 'Content-Disposition': `attachment; filename="learning_records_${startDate || 'all'}_to_${endDate || 'all'}.md"`
      },
    });

  } catch (error) {
    console.error('导出学习记录失败:', error);
    return NextResponse.json(
      { message: '导出学习记录失败', error: error.message },
      { status: 500 }
    );
  }
}