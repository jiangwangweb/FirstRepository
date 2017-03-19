/* http://github.com/mindmup/bootstrap-wysiwyg */
/*global jQuery, $, FileReader*/
/*jslint browser:true*/
(function ($) {
	'use strict';//严格模式
	var readFileIntoDataUrl = function (fileInfo) {
		var loader = $.Deferred(),//创建一个deferred对象。
			fReader = new FileReader();//此接口中提供了读取文件的方法和读取结果的事件模型
		fReader.onload = function (e) {
			loader.resolve(e.target.result);//resolve表示执行状态变为已完成
		};
		fReader.onerror = loader.reject;//执行状态变为以失败
		//出错时触发
		fReader.onprogress = loader.notify;//正在进行中的回调
		//读取中触发
		fReader.readAsDataURL(fileInfo);//将文件读取为DataURL
		return loader.promise();//返回另外一个deferred对象，屏蔽改变执行状态的所有方法
	};
	$.fn.cleanHtml = function () {
		var html = $(this).html();
		return html && html.replace(/(<br>|\s|<div><br><\/div>|&nbsp;)*$/, '');
	};
	$.fn.wysiwyg = function (userOptions) {//fn指jquery命名空间，加上fn的方法和属性，对jquery每一个实例都有效。
		var editor = this,
			selectedRange,
			options,
			toolbarBtnSelector,//创建变量
			updateToolbar = function () {//更新工具栏
				if (options.activeToolbarClass) {
					$(options.toolbarSelector).find(toolbarBtnSelector).each(function () {
					//find返回被选元素的后代元素 each遍历
						var command = $(this).data(options.commandRole);
						//data从被选中元素中返回附加的数据。
						if (document.queryCommandState(command)) {
							//document.queryCommandState检查当前光标所在地方是否有某种样式

							$(this).addClass(options.activeToolbarClass);
                            //如果光标所在位置有command数据，就添加class
						} else {
							$(this).removeClass(options.activeToolbarClass);
							//没有就移除class
						}
					});
				}
			},
			execCommand = function (commandWithArgs, valueArg) {//执行命令
				var commandArr = commandWithArgs.split(' '),
					//把字符串切割成数组
					command = commandArr.shift(),
					//把数组中第一个元素删除，放入变量command中
					args = commandArr.join(' ') + (valueArg || '');
				//把commandArr数组变成字符串，如果有valueArg参数就拼接到结尾
				document.execCommand(command, 0, args);
				updateToolbar();
			},
			bindHotkeys = function (hotKeys) {//遍历数组
				$.each(hotKeys, function (hotkey, command) {
					//hotkey键，command值
					editor.keydown(hotkey, function (e) {
						//当按下按键时触发keydown
						if (editor.attr('contenteditable') && editor.is(':visible')) {
							//attr返回元素的属性值
							e.preventDefault();//阻止event默认行为
							e.stopPropagation();//阻止事件传播，阻止它被分配到其他节点
							execCommand(command);
						}
					}).keyup(hotkey, function (e) {
						//按键松开时触发keyup
						if (editor.attr('contenteditable') && editor.is(':visible')) {
							e.preventDefault();
							e.stopPropagation();
						}
					});
				});
			},
			getCurrentRange = function () {//得到现在的范围
				var sel = window.getSelection();
				// window.getSelection()获取鼠标划取部分的起始位置和结束位置
				if (sel.getRangeAt && sel.rangeCount) {
					return sel.getRangeAt(0);
					//getRangeAt将selection转换为w3c range
				}
				//range用户文本的选择范围，
			},
			saveSelection = function () {//保存selection对象
				selectedRange = getCurrentRange();
			},
			restoreSelection = function () {//还原selection对象
				var selection = window.getSelection();
				if (selectedRange) {
					try {
						selection.removeAllRanges();
					} catch (ex) {
						document.body.createTextRange().select();
						document.selection.empty();
					}

					selection.addRange(selectedRange);
				}
			},
			insertFiles = function (files) {//插入文件
				editor.focus();//获得焦点时触发
				$.each(files, function (idx, fileInfo) {
					//遍历idx键，fileInfo值。
					if (/^image\//.test(fileInfo.type)) {
						//test用于检测字符串是否匹配某个模式
						$.when(readFileIntoDataUrl(fileInfo)).done(function (dataUrl) {
							execCommand('insertimage', dataUrl);
						}).fail(function (e) {
							options.fileUploadError("file-reader", e);
						});
					} else {
						options.fileUploadError("unsupported-file-type", fileInfo.type);
					}
				});
			},
			markSelection = function (input, color) {//标记
				restoreSelection();
				if (document.queryCommandSupported('hiliteColor')) {
					//获取浏览器是否支持报告特定的编辑器命令状态，如果命令不被支持，将触发 NotSupportedError 异常
					document.execCommand('hiliteColor', 0, color || 'transparent');
				}
				saveSelection();
				input.data(options.selectionMarker, color);
			},
			bindToolbar = function (toolbar, options) {
				toolbar.find(toolbarBtnSelector).click(function () {
					restoreSelection();
					editor.focus();
					execCommand($(this).data(options.commandRole));
					saveSelection();
				});
				toolbar.find('[data-toggle=dropdown]').click(restoreSelection);

				toolbar.find('input[type=text][data-' + options.commandRole + ']').on('webkitspeechchange change', function () {
					var newValue = this.value; /* ugly but prevents fake double-calls due to selection restoration */
					this.value = '';
					restoreSelection();
					if (newValue) {
						editor.focus();
						execCommand($(this).data(options.commandRole), newValue);
					}
					saveSelection();
				}).on('focus', function () {
					var input = $(this);
					if (!input.data(options.selectionMarker)) {
						markSelection(input, options.selectionColor);
						input.focus();
					}
				}).on('blur', function () {
					var input = $(this);
					if (input.data(options.selectionMarker)) {
						markSelection(input, false);
					}
				});
				toolbar.find('input[type=file][data-' + options.commandRole + ']').change(function () {
					restoreSelection();
					if (this.type === 'file' && this.files && this.files.length > 0) {
						insertFiles(this.files);
					}
					saveSelection();
					this.value = '';
				});
			},
			initFileDrops = function () {
				editor.on('dragenter dragover', false)
					.on('drop', function (e) {
						var dataTransfer = e.originalEvent.dataTransfer;
						e.stopPropagation();
						e.preventDefault();
						if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
							insertFiles(dataTransfer.files);
						}
					});
			};
		options = $.extend({}, $.fn.wysiwyg.defaults, userOptions);
		//将$.fn.wysiwyg.defaults，userOptions合并到{}中，保存在options中
		toolbarBtnSelector = 'a[data-' + options.commandRole + '],button[data-' + options.commandRole + '],input[type=button][data-' + options.commandRole + ']';
		bindHotkeys(options.hotKeys);
		if (options.dragAndDropImages) {
			initFileDrops();
		}
		bindToolbar($(options.toolbarSelector), options);
		editor.attr('contenteditable', true)
			.on('mouseup keyup mouseout', function () {
				saveSelection();
				updateToolbar();
			});
		$(window).bind('touchend', function (e) {
			var isInside = (editor.is(e.target) || editor.has(e.target).length > 0),
				currentRange = getCurrentRange(),
				clear = currentRange && (currentRange.startContainer === currentRange.endContainer && currentRange.startOffset === currentRange.endOffset);
			if (!clear || isInside) {
				saveSelection();
				updateToolbar();
			}
		});
		return this;
	};
	$.fn.wysiwyg.defaults = {
		hotKeys: {
			'ctrl+b meta+b': 'bold',
			'ctrl+i meta+i': 'italic',
			'ctrl+u meta+u': 'underline',
			'ctrl+z meta+z': 'undo',
			'ctrl+y meta+y meta+shift+z': 'redo',
			'ctrl+l meta+l': 'justifyleft',
			'ctrl+r meta+r': 'justifyright',
			'ctrl+e meta+e': 'justifycenter',
			'ctrl+j meta+j': 'justifyfull',
			'shift+tab': 'outdent',
			'tab': 'indent'
		},
		toolbarSelector: '[data-role=editor-toolbar]',
		commandRole: 'edit',
		activeToolbarClass: 'btn-info',
		selectionMarker: 'edit-focus-marker',
		selectionColor: 'darkgrey',
		dragAndDropImages: true,
		fileUploadError: function (reason, detail) { console.log("File upload error", reason, detail); }
	};
}(window.jQuery));
