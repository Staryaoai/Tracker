import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { format } from 'date-fns';

const sql = neon(process.env.POSTGRES_URL);

export async function GET(request) {
  try {
    // 获取查询参数，与导出功能保持一致
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
      queryParams.push(`${startDate} 00:00:00`);
      conditions.push(`created_at >= $${queryParams.length}`);
    }
    if (endDate) {
      queryParams.push(`${endDate} 23:59:59`);
      conditions.push(`created_at <= $${queryParams.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at ASC;`;

    console.log('Executing query for summary:', query);
    console.log('With parameters:', queryParams);

    const queryResult = await sql.query(query, queryParams);
    const records = queryResult;

    console.log('Database records for summary:', records);
    console.log('Records count:', records.length);

    if (!records || records.length === 0) {
      return NextResponse.json({ message: '该时间范围内没有记录可总结' }, { status: 404 });
    }

    // 准备发送给OpenRouter的数据
    let contentForAI = '';
    records.forEach(record => {
      if (record && record.created_at) {
        const formattedTime = format(new Date(record.created_at), 'yyyy-MM-dd HH:mm:ss');
        contentForAI += `时间: ${formattedTime}\n标题: ${record.title}\n内容: ${record.content || '没有内容'}\n\n---\n\n`;
      }
    });    // 调用AI API（支持配置不同的API endpoint和模型）
    const apiEndpoint = process.env.AI_API_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions';
    const aiModel = process.env.AI_MODEL || 'deepseek/deepseek-chat-v3-0324';
    
    // 根据不同的API服务设置不同的认证headers
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // OpenRouter API
    if (apiEndpoint.includes('openrouter.ai')) {
      headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Learning Tracker';
    }
    // OpenAI API
    else if (apiEndpoint.includes('api.openai.com')) {
      headers['Authorization'] = `Bearer ${process.env.OPENAI_API_KEY}`;
    }
    // Anthropic API
    else if (apiEndpoint.includes('api.anthropic.com')) {
      headers['x-api-key'] = process.env.ANTHROPIC_API_KEY;
      headers['anthropic-version'] = '2023-06-01';
    }
    // 默认使用OpenRouter格式
    else {
      headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
      headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      headers['X-Title'] = 'Learning Tracker';
    }
    
    const openRouterResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的学习助手，擅长分析和总结学习记录。请根据用户提供的学习记录，生成一份结构化的总结报告。

报告应该包含以下部分：
1. **学习概述** - 总体学习情况概述
2. **主要学习内容** - 归纳主要学习主题和知识点
3. **学习进展** - 分析学习的时间分布和频率
4. **知识体系** - 整理学习内容的知识结构
5. **学习建议** - 基于记录内容提出改进建议

请用中文撰写，语言专业且易懂，格式使用Markdown。`
          },
          {
            role: 'user',
            content: `请为以下学习记录生成一份总结报告：

${contentForAI}

请分析这些学习记录，生成一份结构化的学习总结报告。`
          }
        ],
        max_tokens: 4000,
        temperature: 0.7
      })
    });    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API调用失败: ${openRouterResponse.status} ${errorText}`);
    }

    const aiResponse = await openRouterResponse.json();
    console.log('AI API response:', aiResponse);

    if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
      throw new Error('AI API返回格式异常');
    }

    const summary = aiResponse.choices[0].message.content;

    // 添加报告头部信息
    const reportHeader = `# 学习记录AI总结报告

**生成时间**: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
**记录数量**: ${records.length} 条
**时间范围**: ${startDate ? `${startDate} 到 ${endDate || '今天'}` : '全部时间'}

---

`;

    const finalSummary = reportHeader + summary;

    return NextResponse.json({
      success: true,
      summary: finalSummary,
      recordCount: records.length,
      dateRange: { startDate, endDate }
    });

  } catch (error) {
    console.error('生成AI总结失败:', error);
    return NextResponse.json(
      { message: '生成AI总结失败', error: error.message },
      { status: 500 }
    );
  }
}
