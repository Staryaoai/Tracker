import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// 在函数外部初始化 sql 对象，以便在多个请求之间复用连接（如果环境支持）
// process.env.POSTGRES_URL 是从 .env.local 文件中读取的数据库连接字符串
const sql = neon(process.env.POSTGRES_URL);

export async function GET(request) {
  try {
    // 执行一个简单的 SQL 查询来验证连接
    // SELECT NOW(); 是一个标准的 SQL 命令，用于获取数据库服务器的当前时间
    const dbResponse = await sql`SELECT NOW();`;

    // 如果查询成功，dbResponse 会包含结果
    // 例如，dbResponse[0].now 会是当前的时间戳
    const currentTime = dbResponse[0] ? dbResponse[0].now : '未知时间';

    return NextResponse.json({
      message: '成功连接到数据库！',
      databaseTime: currentTime
    });

  } catch (error) {
    console.error('数据库连接或查询失败:', error);
    // 如果发生错误，返回错误信息
    // 注意：在生产环境中，不要直接暴露详细的错误信息给客户端
    return NextResponse.json(
      { message: '连接数据库失败', error: error.message },
      { status: 500 } // 设置 HTTP 状态码为 500 (服务器内部错误)
    );
  }
}