'use client'; // Add this at the top

import { useState, useEffect } from 'react';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // null for 'All Records'
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // To disable button during submission
  const [error, setError] = useState(''); // For displaying form errors
  const [successMessage, setSuccessMessage] = useState(''); // For displaying success message
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(''); // YYYY-MM-DD
  const [exportEndDate, setExportEndDate] = useState('');   // YYYY-MM-DD
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [editingRecordId, setEditingRecordId] = useState(null); // null when not editing, or the ID of the record being edited
  const [selectedExportRange, setSelectedExportRange] = useState('all_time'); // Default to 'all_time'
  const exportRangeOptions = [
  { value: 'today', label: '今天' },
  { value: 'past_7_days', label: '过去7天' },
  { value: 'past_30_days', label: '过去30天' },
  { value: 'past_year', label: '过去一年' },
  { value: 'all_time', label: '所有时间' },
  ];

  const handleSaveRecord = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!newTitle.trim()) {
      setError('标题不能为空！');
      return;
    }

    setIsSubmitting(true);

    const recordData = {
      title: newTitle.trim(),
      content: newContent.trim(),
      category_id: selectedCategory, // selectedCategory is already correctly set when editing
    };

    try {
      let response;
      let successMessageText = '';

      if (editingRecordId) {
        // ----- EDIT MODE -----
        console.log(`Updating record ID: ${editingRecordId} with data:`, recordData);
        response = await fetch(`/api/records/${editingRecordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recordData),
        });
        successMessageText = '学习记录已成功更新！';
      } else {
        // ----- ADD NEW MODE -----
        console.log('Creating new record with data:', recordData);
        response = await fetch('/api/records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recordData),
        });
        successMessageText = '学习记录已成功保存！';
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || (editingRecordId ? '更新记录失败' : '创建记录失败'));
      }

      const resultData = await response.json();
      console.log(editingRecordId ? '记录更新成功:' : '记录创建成功:', resultData);
      setSuccessMessage(successMessageText);

      // Reset form and editing state
      setNewTitle('');
      setNewContent('');
      // setSelectedCategory(null); // Optionally reset selected category or keep it
      if (editingRecordId) {
        setEditingRecordId(null); // Exit edit mode
      }

      await fetchRecords(); // Refresh the list of displayed records

    } catch (err) {
      console.error(editingRecordId ? '更新记录时出错:' : '创建记录时出错:', err);
      setError(err.message || (editingRecordId ? '更新时发生未知错误' : '创建时发生未知错误'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecordId(record.id);
    setNewTitle(record.title);
    setNewContent(record.content || ''); // Ensure content is not null/undefined for the textarea
    setSelectedCategory(record.category_id || null); // Set the category dropdown/selection
    setError(''); // Clear any previous form errors
    setSuccessMessage(''); // Clear any previous success messages
    window.scrollTo({ top: document.getElementById('records-section').offsetTop, behavior: 'smooth' }); // Scroll to the form
  };

  const fetchRecords = async () => {
      setIsLoadingRecords(true);
      try {
        const response = await fetch('/api/records'); // API returns all records with category info
        if (!response.ok) {
          throw new Error('获取记录失败');
        }
        const data = await response.json();
        setRecords(data);
      } catch (err) {
        console.error("获取记录时出错:", err);
        setError(err.message || '获取记录时发生未知错误'); // Optionally display this error
      } finally {
        setIsLoadingRecords(false);
      }
    };
  
  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');

    let startDateStr = '';
    let endDateStr = '';
    const today = new Date();

    switch (selectedExportRange) {
      case 'today':
        startDateStr = format(startOfDay(today), 'yyyy-MM-dd');
        endDateStr = format(endOfDay(today), 'yyyy-MM-dd');
        break;
      case 'past_7_days':
        startDateStr = format(startOfDay(subDays(today, 6)), 'yyyy-MM-dd'); // Today and previous 6 days
        endDateStr = format(endOfDay(today), 'yyyy-MM-dd');
        break;
      case 'past_30_days':
        startDateStr = format(startOfDay(subDays(today, 29)), 'yyyy-MM-dd'); // Today and previous 29 days
        endDateStr = format(endOfDay(today), 'yyyy-MM-dd');
        break;
      case 'past_year':
        startDateStr = format(startOfDay(subYears(today, 1)), 'yyyy-MM-dd'); // From one year ago
        endDateStr = format(endOfDay(today), 'yyyy-MM-dd');
        break;
      case 'all_time':
      default:
        // No date parameters needed for all time
        break;
    }

    const params = new URLSearchParams();
    if (startDateStr) {
      params.append('startDate', startDateStr);
    }
    if (endDateStr) {
      params.append('endDate', endDateStr);
    }
    const queryString = params.toString();

    console.log(`Exporting with range: ${selectedExportRange}, startDate: ${startDateStr}, endDate: ${endDateStr}`);

    try {
      const response = await fetch(`/api/records/export${queryString ? `?${queryString}` : ''}`);

      if (!response.ok) {
        // ... (error handling logic from your previous handleExport - keep it the same)
        let errorResponseMessage = `导出失败 (状态码: ${response.status})`;
        let rawErrorText = '';
        try {
          rawErrorText = await response.text();
          console.error('服务器返回的原始错误响应:', rawErrorText);
          const errorData = JSON.parse(rawErrorText);
          if (errorData && errorData.message) {
            errorResponseMessage = errorData.message;
          } else {
            errorResponseMessage = `导出失败: ${rawErrorText.substring(0, 200)}`;
          }
        } catch (e) {
          console.warn('无法将错误响应解析为JSON:', e);
          if (rawErrorText) {
            errorResponseMessage = `导出失败 (状态码: ${response.status})。服务器响应: ${rawErrorText.substring(0, 200)}...`;
          } else {
            errorResponseMessage = `导出失败 (状态码: ${response.status})，且无法读取错误内容。`;
          }
        }
        throw new Error(errorResponseMessage);
      }

      const markdownContent = await response.text();

      // Trigger file download (keep this logic the same)
      const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);

      const currentDate = new Date();
      const formattedCurrentDate = `<span class="math-inline">\{currentDate\.getFullYear\(\)\}</span>{(currentDate.getMonth()+1).toString().padStart(2, '0')}${currentDate.getDate().toString().padStart(2, '0')}`;
      let fileName = `learning_records_${selectedExportRange}_${formattedCurrentDate}.md`;

      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (err) {
      console.error("导出记录时捕获到错误:", err, err.stack);
      setExportError(err.message || '导出时发生未知错误，请查看控制台日志。');
    } finally {
      setIsExporting(false);
    }
  };
    
  // Fetch categories from the API
  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/categories');
        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        console.error("Error fetching categories:", error);
        // Handle error (e.g., show a message to the user)
      }
    }
    fetchCategories();
  }, []); // Empty dependency array means this runs once on mount

  // Modified useEffect for initial data fetching
    useEffect(() => {
      async function fetchData() {
        // Fetch categories
        try {
          const catResponse = await fetch('/api/categories');
          if (!catResponse.ok) throw new Error('Failed to fetch categories');
          setCategories(await catResponse.json());
        } catch (error) {
          console.error("Error fetching categories:", error);
        }
        // Fetch records
        await fetchRecords(); // Call the new function
      }
      fetchData();
    }, []); // Empty dependency array means this runs once on mount

  // Handle category selection
  const handleSelectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    // Later, we will fetch records based on this categoryId
    console.log("Selected category ID:", categoryId); 
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">我的学习记录</h1>

      <div className="w-full max-w-4xl"> {/* Increased max-width */}
        <div className="mb-8 p-4 bg-white shadow-md rounded-lg"> {/* Card-like container for tags */}
          <h2 className="text-xl md:text-2xl font-semibold mb-4 text-gray-700">学习大类</h2>
          <div id="tags-container" className="flex flex-wrap gap-3">
            <button
              onClick={() => handleSelectCategory(null)} // null for 'All Records'
              className={`font-semibold py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out
                          ${selectedCategory === null 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              全部记录
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleSelectCategory(category.id)}
                className={`font-semibold py-2 px-4 rounded-lg transition-colors duration-150 ease-in-out
                            ${selectedCategory === category.id 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                {category.name}
              </button>
            ))}
            {/* TODO: Add a way to create new categories from the UI later */}
          </div>
        </div>

        {/* 学习记录的输入区和显示区将放在这里 */}
        <div id="records-section" className="mt-8 bg-white shadow-xl rounded-xl p-6 md:p-8"> {/* Enhanced styling */}
          <h2 className="text-xl md:text-2xl font-semibold mb-6 text-gray-800 border-b pb-3">
            {editingRecordId
              ? `编辑记录: "${records.find(r => r.id === editingRecordId)?.title || ''}"`
              : (selectedCategory === null 
                  ? '添加新记录 (全部记录)' 
                  : `添加新记录到 "${categories.find(cat => cat.id === selectedCategory)?.name || '分类'}"`)
            }
          </h2>
              
          {/* Input Form */}
          <form onSubmit={handleSaveRecord} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                标题 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow text-gray-900" // <-- Added text-gray-900
                placeholder="请输入记录标题"
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                内容
              </label>
              <textarea
                id="content"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows="5"
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow text-gray-900" // <-- Added text-gray-900
                placeholder="请输入学习内容..."
              ></textarea>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
            {successMessage && <p className="text-sm text-green-600 bg-green-100 p-3 rounded-md">{successMessage}</p>}
            
            <div className="flex justify-end space-x-3"> {/* Added space-x-3 for button spacing */}
              {editingRecordId && ( // Show Cancel button only in edit mode
                <button
                  type="button" // Important: type="button" to prevent form submission
                  onClick={() => {
                    setEditingRecordId(null);
                    setNewTitle('');
                    setNewContent('');
                    setSelectedCategory(selectedCategory); // Or reset to null: setSelectedCategory(null)
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all"
                >
                  取消编辑
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed
                            ${editingRecordId 
                              ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500' 
                              : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'}`}
              >
                {isSubmitting 
                  ? (editingRecordId ? '更新中...' : '保存中...') 
                  : (editingRecordId ? '更新记录' : '保存记录')}
              </button>
            </div>
          </form>
              <div className="mt-12 p-6 md:p-8 bg-white shadow-xl rounded-xl">
          <h2 className="text-xl md:text-2xl font-semibold mb-6 text-gray-800 border-b pb-3">
            导出学习记录
          </h2>
          <div className="items-center space-y-4 md:space-y-0 md:flex md:space-x-4"> {/* Adjusted for flex layout */}
            <div className="flex-grow"> {/* Changed flex-1 to flex-grow for better sizing */}
              <label htmlFor="exportRange" className="block text-sm font-medium text-gray-700 mb-1">
                选择导出范围
              </label>
              <select
                id="exportRange"
                value={selectedExportRange}
                onChange={(e) => setSelectedExportRange(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
              >
                {exportRangeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-5 md:pt-0 self-end"> {/* self-end to align button with select bottom */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full md:w-auto px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? '导出中...' : '导出为 .md 文件'}
              </button>
            </div>
          </div>
          {exportError && <p className="mt-3 text-sm text-red-600 bg-red-100 p-3 rounded-md">{exportError}</p>}
        </div>

        {/* This </div> is the closing tag for <div className="w-full max-w-4xl"> */}
        {/* Ensure this new Export Section is inside that max-width container or <main> as appropriate */}
          {/* Records will be listed below this form later */}
           {/* Records will be listed below this form later */}
              <div className="mt-10">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 border-b pb-2">已有记录：</h3>
                {isLoadingRecords ? (
                  <p className="text-gray-500">正在加载记录...</p>
                ) : records.length === 0 ? (
                  <p className="text-gray-500">还没有任何学习记录。开始添加第一条吧！</p>
                ) : (
                  <ul className="space-y-4">
                    {records
                      .filter(record =>
                        selectedCategory === null || record.category_id === selectedCategory
                      )
                      .map((record) => (
                        <li key={record.id} className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg shadow transition-colors">
                          <div className="flex justify-between items-start"> {/* Changed items-center to items-start for multi-line titles */}
                            <div>
                              <h4 className="text-md font-semibold text-blue-700">{record.title}</h4>
                              <span className="text-xs text-gray-500 block mt-1"> {/* Timestamp below title */}
                                {new Date(record.created_at).toLocaleString()}
                              </span>
                            </div>
                            <button
                              onClick={() => handleEditRecord(record)}
                              disabled={editingRecordId === record.id} // Disable if already editing this one
                              className="ml-4 px-3 py-1 text-sm bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-md shadow-sm transition-colors disabled:opacity-50"
                            >
                              Edit
                            </button>
                          </div>
                          {record.content && (
                            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{record.content}</p>
                          )}
                          {record.category_name && (
                            <span className="mt-2 inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                              {record.category_name}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
        </div>
      </div>
    </main>
  );
}