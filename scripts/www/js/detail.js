new Vue({
    el: "#detail",
    data: function () {
        return {
            //hsot: "http://192.168.0.107:5050",
            hsot: "https://jobskills.cn/api",
            fileListExcel: [],
            fileName: "",
            re1: "",
            uploadType: 1,//1、开始分析，2、重新分析
            tabType: 1,
            isExcelSaving: false,//是否正在分析数据
            isData: false,//是否已有数据
            source: null,
            sourceIsEnd: false,
            list: [],
            pageIndex: 1,
            pageSize: 5,
            pageTotal: 0,
            showContent: "",
            execlName: ""
        }
    },
    methods: {
        handleChange(file, fileList) {
            const self = this;
            if (file.name.toLocaleLowerCase().indexOf('.csv') == -1
                && file.name.toLocaleLowerCase().indexOf('.xls') == -1
                && file.name.toLocaleLowerCase().indexOf('.xlsx') == -1) {
                self.$message.warning(`只允许上传csv、xls、xlsx格式的文件`);
                self.fileListScript = [];
                return;
            }
            if (file.size >= 10 * 1024 * 1024) {
                self.$message.warning(`文件最大不能超过10M`);
                self.fileListExcel = [];
                return
            }

            self.fileListExcel = fileList;
            self.fileName = file.name;
        },
        handlePreview(file) {
            console.log(file);
        },
        handleRemove(file, fileList) {
            console.log(file, fileList);
        },
        beforeRemove(file, fileList) {
            const self = this;
            return self.$confirm(`确定移除 ${file.name}？`).then(() => {
                self.fileListExcel = []
                self.uploadType = 1
            });
        },
        handleExceed(files, fileList) {
            const self = this;
            self.$message.warning(`只能上传一个文件，如需更换请先移除当前文件`);
        },
        async uploadDefaultFile() {
            const defaultUrl = 'tepmlate/热搜关键词-速卖通珠宝-项链100条-竞争指数.xlsx'; // 放在 public 下
            const fileName = '热搜关键词-速卖通珠宝-项链100条-竞争指数.xlsx';
            const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            try {
                // 1. 获取文件数据
                const response = await fetch(defaultUrl);
                if (!response.ok) throw new Error('文件获取失败');

                // 2. 转为 Blob
                const blob = await response.blob();

                // 3. 构造 File 对象
                const file = new File([blob], fileName, { type: fileType });

                // 4. 调用自定义上传函数（和 el-upload 共用）
                //this.customUpload({ file });
                this.handleChange(file, [{
                    name: file.name,
                    percentage: 0,
                    raw: file,
                    size: 1,
                    status: "ready",
                    uid: new Date().getTime()
                }])
            } catch (err) {
                this.$message.error('默认文件上传失败：' + err.message);
                console.error(err);
            }
        },
        excelToJson() {
            const self = this;

            if (self.isExcelSaving) {
                self.$message.warning(`数据分析中，请稍后`);
                return
            }
            if (self.fileListExcel.length == 0) {
                self.$message.warning(`请先上传文件`);
                return
            }
            self.tabType = 1
            self.isExcelSaving = true
            self.isData = false
            self.resetLoading()

            // 创建FormData
            const formData = new FormData();
            formData.append('file', self.fileListExcel[0].raw);
            formData.append('defiType', "1");//跨境搜索词根解构师2.0-开发版
            formData.append('fileName', self.fileName);//跨境搜索词根解构师2.0-开发版
            axios.post(self.hsot + "/api/defi/GetExcelToJson", formData, {
                // headers: {
                //     'Content-Type': 'multipart/form-data'
                // }
            }).then(function (response) {
                if (response.data.code == 200) {
                    var data = response.data;
                    if (data.code == 200) {
                        self.loading()
                        self.monitoringGetExcelResponseStateMessage(response.data.result, self.monitoringExcel)
                    } else {
                        self.$message.error(`分析失败，请重试！`);
                        self.isExcelSaving = false
                        self.isData = false
                        self.uploadType = 2
                    }
                } else {
                    self.$message.error(`分析失败，请重试！`);
                    self.isExcelSaving = false
                    self.isData = false
                    self.uploadType = 2
                }
            }).catch(function (error) {
                self.$message.error(`分析失败，请重试！`);
                self.isExcelSaving = false
                self.isData = false
                self.uploadType = 2
            });
        },
        monitoringGetExcelResponseStateMessage(id, callbackfunc) {
            const self = this;
            //self.sourceIsEnd = false
            if (typeof EventSource != "undefined") {
                self.source = new EventSource(self.hsot + "/api/defi/GetExcelDefiResponseState?id=" + id);
                self.source.onopen = function (e) {
                    console.log("SSE连接已建立");
                };
                self.source.onmessage = function (e) {
                    var chatMessage = eval("(" + e.data + ")");
                    callbackfunc(chatMessage)
                };
                self.source.onerror = function (e) {//e.data在onerror事件里是undefined
                    console.warn("SSE连接出错或关闭", e);
                };
            }
            else {
                console.log("不支持您的浏览器");
            }
        },
        monitoringExcel(data) {//sse回调函数，用于关闭SSE连接
            const self = this;
            if (data != null) {
                if (data != "[]") {
                    self.loadData(JSON.parse(data.text))
                }

                self.isExcelSaving = false
                self.isData = true
                self.uploadType = 2
                self.source.close();//关闭SSE连接
            }
        },
        tabTypeClick(type) {
            const self = this;
            if (type == 1) {
                self.tabType = type
            } else {
                self.loadPageList()
            }
        },
        handlePageChange(page) {
            const self = this;
            self.pageIndex = page;
            self.loadPageList()
        },
        loadPageList() {
            const self = this;
            axios.get(self.hsot + "/api/defi/GetExceoToJsonCompletePaged?pageIndex=" + self.pageIndex + "&pageSize=" + self.pageSize).then(function (response) {
                var obj = JSON.parse(response.data)
                self.list = obj.Items

                self.pageTotal = obj.TotalNum
                self.tabType = 2
            }).catch(function (error) {
            });
        },
        timeFormat(date) {
            if (date == "") {
                date = new Date();
            } else {
                date = new Date(date);
            }

            var result = date.getFullYear() + "-" + (date.getMonth() + 1 < 10 ? "0" + (date.getMonth() + 1) : date.getMonth() + 1) + "-" + (date.getDate() < 10 ? "0" + date.getDate() : date.getDate()) + " " + (date.getHours() < 10 ? "0" + date.getHours() : date.getHours()) + ":" + (date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes()) + ":" + (date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds());
            return result;
        },
        viewClick(id) {
            const self = this;
            axios.get(self.hsot + "/api/defi/GetExceoToJsonInfo?id=" + id).then(function (response) {
                if (response.data.length > 0) {
                    if (response.data[0].DefiStatus == 1) {
                        self.loadData(JSON.parse(response.data[0].ContentText))

                        self.isExcelSaving = false
                        self.isData = true
                        self.tabType = 1
                        self.source.close();//关闭SSE连接
                    } else if (response.data[0].DefiStatus == 2) {
                        self.$message.warning(`数据生成中，请稍后`);
                    } else if (response.data[0].DefiStatus == 3) {
                        self.$message.warning(`数据生成失败，请重试`);
                    }
                } else {
                    self.$message.warning(`数据生成中，请稍后`);
                }
            }).catch(function (error) {
            });
        },
        deleteClick(id) {
            const self = this;
            return self.$confirm(`确定删除当前数据？`).then(() => {
                axios.get(self.hsot + "/api/defi/DeleteExceoToJsonInfo?id=" + id).then(function (response) {
                    self.$message.success(`删除成功`);
                    self.loadPageList()
                }).catch(function (error) {
                });
            });
        },
        deleteAllClick() {
            const self = this;
            return self.$confirm(`确定清空历史记录？`).then(() => {
                axios.get(self.hsot + "/api/defi/DeleteAllExceoToJsonInfo").then(function (response) {
                    self.$message.success(`删除成功`);
                    self.loadPageList()
                }).catch(function (error) {
                });
            });
        },
        loadData(data) {
            const self = this;
            var obj = data.data.outputs
            self.showContent = obj

            var optList1 = []
            try {
                var op1 = JSON.parse(obj.re1)
                self.re1 = op1
                op1.forEach(item => {
                    optList1.push({ value: item.value, name: item.name })
                })
            } catch (ex) {
                optList1.push({ value: 100, name: "empty" })
            }
            self.echartA(optList1, self.re1)

            var optList2 = []
            var optList22 = []
            var optList222 = []
            try {
                obj.re2.xdata.forEach((item, index) => {
                    var name = item
                    optList2.push(name)
                    if (obj.re2.ydata.length > index) {
                        optList22.push(obj.re2.ydata[index])
                    } else {
                        optList22.push(0)
                    }
                    if (obj.re3.ydata.length > index) {
                        optList222.push(obj.re3.ydata[index])
                    } else {
                        optList222.push(0)
                    }
                })
            } catch (ex) {

            }
            self.echartB(optList2, optList22, optList222)

            var optList3 = []
            var optList33 = []
            try {
                obj.re4.xdata.forEach((item, index) => {
                    var name = item
                    optList3.push(name)
                    if (obj.re4.ydata.length > index) {
                        optList33.push(obj.re4.ydata[index])
                    } else {
                        optList33.push(0)
                    }
                })
            } catch (ex) {

            }
            self.echartC(optList3, optList33)
        },
        echartA(list, temp) {
            const self = this;
            //  饼状图
            var echartA = echarts.init(document.getElementById('echartA'));
            optionA = {
                color: [
                    "#43D39F",
                    "#FFC74F",
                    "#FF7D7D",
                    "#67A1FF",

                    "#0f62fc",
                    "#45dbf7",
                    "#f6d54a",
                    "#f6a54a",
                    "#ff4343",
                    "#f1bb4c",

                    "#00d488",
                    "#3feed4",
                    "#afa3f5",
                    "#3bafff",

                    "#f845f1",
                    "#ad46f3",
                    "#5045f6",
                    "#4777f5",
                    "#44aff0",
                    "#45dbf7",
                    "#f6d54a",
                    "#f6a54a",
                    "#f69846",
                    "#ff4343"
                ],
                tooltip: {
                    trigger: 'item',
                    formatter: function (params) {
                        // ✅ 可以访问 temp！因为处在同一个函数作用域（闭包）
                        const item = temp[params.dataIndex]; // 找到原始数据项（与 list 对应）
                        var str = "<br/>关键词列表：<br/>"
                        item.categoryList.forEach(item => {
                            str += item + "<br/>"
                        })

                        //return '{a} <br/>{b} : {c} ({d}%)'
                        return params.seriesName + '：<br/>' +
                            params.name + ' : ' +
                            params.value + ' (' + params.percent + '%)' + str;
                    }
                },
                legend: {
                    type: 'scroll',           // 关键：开启滚动图例
                    icon: "circle",
                    itemWidth: 10,
                    itemHeight: 10,
                    right: '5%',
                    top: '10%',
                    bottom: '10%',
                    orient: 'vertical',
                    pageButtonItemGap: 10,     // 页面按钮与内容间距
                    pageButtonGap: 10,
                    pageButtonPosition: 'end'  // 滚动按钮位置
                },
                series: [
                    {
                        name: '关键词词根',
                        type: 'pie',
                        radius: '58%',
                        label: {
                            show: true
                        },
                        labelLine: {
                            show: true
                        },
                        center: ['50%', '45%'],
                        data: list
                    }
                ]
            };
            echartA.setOption(optionA);
        },
        echartB(list, list2, list3) {
            // 柱状图
            var myChartB = echarts.init(document.getElementById('echartB'));
            optionB = {
                // title: {
                //     subtext: '个',
                //     left: '50px',
                //     top:'10px'
                // },
                tooltip: {
                    trigger: "axis",
                    axisPointer: {
                        type: "shadow",
                        label: {
                            show: true,
                            backgroundColor: "#333",
                        },
                    },
                },
                legend: {
                    icon: "circle",
                    itemWidth: 10,  // 设置宽度
                    itemHeight: 10, // 设置高度
                    bottom: 0
                },
                grid: {
                    bottom: '10%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: list,
                    //网格样式
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: ['rgb(229, 233, 242)'],
                            width: 1,
                            type: 'solid'
                        }
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#aaa'
                        }
                    },
                    axisLabel: {
                        rotate: 90,
                        interVal: 0
                    }
                },
                yAxis: [
                    {
                        type: 'value',
                        position: 'left',  // Y轴在左侧
                        axisLine: {
                            lineStyle: {
                                color: '#aaa'
                            }
                        },
                        //网格样式
                        splitLine: {
                            show: true,
                            lineStyle: {
                                color: ['rgb(229, 233, 242)'],
                                width: 1,
                                type: 'solid'
                            }
                        }
                    },
                    {
                        type: 'value',
                        position: 'right',  // Y轴在右侧
                        axisLine: {
                            lineStyle: {
                                color: '#aaa'
                            }
                        },
                        //网格样式
                        splitLine: {
                            show: false
                        },
                        axisLabel: {
                            formatter: '{value}%'  // ✅ 关键：显示百分号
                        }
                    },
                ],
                series: [{
                    name: '搜索量',
                    data: list3,
                    type: 'bar',
                    barWidth: '20px',
                    yAxisIndex: 0, // 使用第一个Y轴（左侧）
                    label: {
                        show: false,
                        position: 'top',
                        valueAnimation: true
                    },
                    itemStyle: {
                        // 定义线性渐变
                        color: new echarts.graphic.LinearGradient(
                            0, 0,  // 渐变起点（左上角）
                            0, 1,  // 渐变终点（左下角）
                            [
                                { offset: 0, color: '#f1bb4c' },  // 顶部颜色
                                { offset: 1, color: '#fff' }   // 底部颜色
                            ]
                        )
                    },
                }, {
                    name: '转化率',
                    data: list2,
                    type: 'line',
                    smooth: true,
                    yAxisIndex: 1, // 使用第二个Y轴（右侧）
                    label: {
                        show: false
                    },
                    itemStyle: {
                        color: "#0f62fc"
                    },
                }]
            };
            myChartB.setOption(optionB);
        },
        echartC(list, list2) {
            // 柱状图
            var myChartC = echarts.init(document.getElementById('echartC'));
            optionC = {
                tooltip: {
                    trigger: "axis",
                    axisPointer: {
                        type: "shadow",
                        label: {
                            show: true,
                            backgroundColor: "#333",
                        },
                    },
                },
                legend: {
                    icon: "circle",
                    itemWidth: 10,  // 设置宽度
                    itemHeight: 10, // 设置高度
                    bottom: 0
                },
                grid: {
                    bottom: '10%',
                    containLabel: true
                },
                xAxis: {
                    type: 'category',
                    data: list,
                    //网格样式
                    splitLine: {
                        show: true,
                        lineStyle: {
                            color: ['rgb(229, 233, 242)'],
                            width: 1,
                            type: 'solid'
                        }
                    },
                    axisLine: {
                        lineStyle: {
                            color: '#aaa'
                        }
                    },
                    axisLabel: {
                        rotate: 90,
                        interVal: 0
                    }

                },
                yAxis: [
                    {
                        type: 'value',
                        position: 'left',  // Y轴在左侧
                        axisLabel: {
                            formatter: '{value} K' // {value} 代表刻度数值
                        },
                        axisLine: {
                            lineStyle: {
                                color: '#aaa'
                            }
                        },
                        //网格样式
                        splitLine: {
                            show: true,
                            lineStyle: {
                                color: ['rgb(229, 233, 242)'],
                                width: 1,
                                type: 'solid'
                            }
                        }
                    }
                ],

                series: [{
                    name: '搜索量',
                    data: list2,
                    type: 'bar',
                    barWidth: '20px',
                    yAxisIndex: 0, // 使用第一个Y轴（左侧）
                    label: {
                        show: false,
                        position: 'top',
                        valueAnimation: true
                    },
                    itemStyle: {
                        // 定义线性渐变
                        color: new echarts.graphic.LinearGradient(
                            0, 0,  // 渐变起点（左上角）
                            0, 1,  // 渐变终点（左下角）
                            [
                                { offset: 0, color: '#2879fe' },  // 顶部颜色
                                { offset: 1, color: '#fff' }   // 底部颜色
                            ]
                        )
                    },
                }]
            };
            myChartC.setOption(optionC);
        },
        downloadEchart(name) {
            // 获取图表实例
            const chartInstance = echarts.init(document.getElementById(name));

            // 下载 PNG 图片
            // 方法1：直接下载
            const url = chartInstance.getDataURL({
                type: 'png',
                pixelRatio: 2,  // 提高图片清晰度
                backgroundColor: '#fff'
            });

            var downloadname = '';
            if (name == 'echartA') {
                downloadname = '关键词词根词频统计'
            }
            else if (name == 'echartB') {
                downloadname = '关键词词根搜索与转化统计'
            }
            else {
                downloadname = '关键词词根蓝海值'
            }
            // 创建下载链接
            const a = document.createElement('a');
            a.href = url;
            a.download = `${downloadname}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        },
        downloadfile(url, strFileName) {
            const self = this;
            var strMimeType = self.getFileType(url);
            var xmlHttp = null;
            if (window.ActiveXObject) {
                // IE6, IE5 浏览器执行代码
                xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
            } else if (window.XMLHttpRequest) {
                // IE7+, Firefox, Chrome, Opera, Safari 浏览器执行代码
                xmlHttp = new XMLHttpRequest();
            }
            //2.如果实例化成功，就调用open（）方法：
            if (xmlHttp != null) {
                xmlHttp.open("get", url, true);
                xmlHttp.responseType = 'blob';//关键
                xmlHttp.send();
                xmlHttp.onreadystatechange = doResult; //设置回调函数
            }
            function doResult() {
                if (xmlHttp.readyState == 4) { //4表示执行完成
                    if (xmlHttp.status == 200) { //200表示执行成功
                        download(xmlHttp.response, strFileName, strMimeType);
                    }
                }
            }
        },
        getFileType(fileName) {
            // 后缀获取
            let suffix = '';
            // 获取类型结果
            let result = '';
            try {
                const flieArr = fileName.split('.');
                suffix = flieArr[flieArr.length - 1];
            } catch (err) {
                suffix = '';
            }
            // fileName无后缀返回 false
            if (!suffix) { return false; }
            suffix = suffix.toLocaleLowerCase();
            // 图片格式
            const imglist = ['png', 'jpg', 'jpeg', 'bmp', 'gif'];
            // 进行图片匹配
            result = imglist.find(item => item === suffix);
            if (result) {
                return 'image';
            }
            // 匹配txt
            const txtlist = ['txt'];
            result = txtlist.find(item => item === suffix);
            if (result) {
                return 'txt';
            }
            // 匹配 excel
            const excelist = ['xls', 'xlsx'];
            result = excelist.find(item => item === suffix);
            if (result) {
                return 'excel';
            }
            // 匹配 word
            const wordlist = ['doc', 'docx'];
            result = wordlist.find(item => item === suffix);
            if (result) {
                return 'word';
            }
            // 匹配 pdf
            const pdflist = ['pdf'];
            result = pdflist.find(item => item === suffix);
            if (result) {
                return 'pdf';
            }
            // 匹配 ppt
            const pptlist = ['ppt', 'pptx'];
            result = pptlist.find(item => item === suffix);
            if (result) {
                return 'ppt';
            }
            // 匹配 视频
            const videolist = ['mp4', 'm2v', 'mkv', 'rmvb', 'wmv', 'avi', 'flv', 'mov', 'm4v'];
            result = videolist.find(item => item === suffix);
            if (result) {
                return 'video';
            }
            // 匹配 音频
            const radiolist = ['mp3', 'wav', 'wmv'];
            result = radiolist.find(item => item === suffix);
            if (result) {
                return 'radio';
            }

            // 其他 文件类型
            return 'other';
        },
        downloadExcel(type) {
            const self = this;
            var titleList = ""
            var contentList = []
            if (type == 1) {
                self.execlName = "关键词词根词频统计.xlsx"
                var obj = JSON.parse(self.showContent.re1)
                titleList = "长尾词内容,词频,占比"
                obj.forEach(item => {
                    contentList.push({
                        name: item.name,
                        percent: item.percent,
                        value: item.value
                    })
                })
            } else if (type == 2) {
                self.execlName = "关键词词根搜索与转化统计.xlsx"
                titleList = "关键词词根,搜索量,转化率"
                self.showContent.re2.xdata.forEach((item, index) => {
                    var temp = {
                        name: item,
                        percent: "",
                        value: ""
                    }
                    if (self.showContent.re3.ydata.length > index) {
                        temp.value = self.showContent.re3.ydata[index]
                    }
                    if (self.showContent.re2.ydata.length > index) {
                        temp.percent = self.showContent.re2.ydata[index] + "%"
                    }
                    contentList.push(temp)
                })
            } else if (type == 3) {
                self.execlName = "关键词词根蓝海值.xlsx"
                titleList = "关键词词根,相对值"
                self.showContent.re4.xdata.forEach((item, index) => {
                    var temp = {
                        name: item,
                        value: ""
                    }
                    if (self.showContent.re4.ydata.length > index) {
                        temp.value = self.showContent.re4.ydata[index]
                    }
                    contentList.push(temp)
                })
            }
            const objSubmit = {
                titleList: titleList,
                contentList: JSON.stringify(contentList),
                excelType: type
            }
            axios.post(self.hsot + "/api/defi/ExportToExcel", objSubmit).then(function (response) {
                self.downloadBase64File(response.data, self.execlName)
            }).catch(function (error) {
            });
        },
        downloadBase64File(base64String, fileName, mimeType = 'application/octet-stream') {
            try {
                // 1. 将Base64转换为Blob
                const byteCharacters = atob(base64String);
                const byteNumbers = new Array(byteCharacters.length);

                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }

                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });

                // 2. 创建下载链接
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');

                link.href = url;
                link.download = fileName;
                link.style.display = 'none';

                // 3. 触发下载
                document.body.appendChild(link);
                link.click();

                // 4. 清理
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);

            } catch (error) {
                throw new Error(`Base64转换失败: ${error.message}`);
            }
        },
        resetLoading() {
            const steps = document.querySelectorAll('.process-step');
            // 初始所有步骤标记为未完成
            steps.forEach(step => step.classList.add('step-todo'));
        },
        loading() {
            const steps = document.querySelectorAll('.process-step');
            setTimeout(() => steps[0].classList.replace('step-todo', 'step-done'), 1000); // 步骤1完成
            setTimeout(() => steps[1].classList.replace('step-todo', 'step-done'), 2000); // 步骤2完成
            setTimeout(() => steps[2].classList.replace('step-todo', 'step-doing'), 2000); // 步骤3进行中
            setTimeout(() => steps[2].classList.replace('step-doing', 'step-done'), 3000); // 步骤3完成
            setTimeout(() => steps[3].classList.replace('step-todo', 'step-doing'), 4000); // 步骤4进行中
            setTimeout(() => steps[3].classList.replace('step-doing', 'step-done'), 5000); // 步骤4完成
            setTimeout(() => steps[4].classList.replace('step-todo', 'step-doing'), 6000); // 步骤5进行中
            setTimeout(() => steps[4].classList.replace('step-doing', 'step-done'), 7000); // 步骤5完成
        }
    },
    mounted: function () {
        //this.loading()
    }
})