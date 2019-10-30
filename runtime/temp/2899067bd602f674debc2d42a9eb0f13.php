<?php if (!defined('THINK_PATH')) exit(); /*a:3:{s:81:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\public/../application/index\view\index\sign.html";i:1572447118;s:72:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\head.html";i:1572367651;s:74:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\footer.html";i:1572369561;}*/ ?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>报名信息填写</title>
    <link rel="stylesheet" href="/assets/css/index/reset.css">
<link rel="stylesheet" href="/assets/css/index/common.css">

    <style>
        .container {
            width: 94%;
            padding-top: 20px;
            margin: 0 auto;
            color: #171717;
            box-sizing: border-box;
        }

        .item {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }

        .item .label {
            position: relative;
            flex: 0 0 120px;
            padding-right: 5px;
            font-size: 14px;
            text-align: right;
            box-sizing: border-box;
        }

        .item .label .tip {
            position: absolute;
            bottom: 0;
            right: 24px;
            transform: translateY(80%);
            font-size: 12px;
            color: #027ad9;
        }

        .item .content {
            flex: 1;
        }

        select,
        input[type='text'] {
            padding: 5px;
            width: 100%;
            border-radius: 3px;
            box-sizing: border-box;
            border: 1px solid #ccc;
            outline: none;
        }

        button.submit {
            width: 100%;
            padding: 10px 0;
            margin-top: 30px;
            border: none;
            border-radius: 5px;
            background-color: #027ad9;
            color: #fff;
        }

        button.send {
            padding: 5px;
            margin-left: 5px;
            color: #fff;
            border: none;
            background-color: #027ad9;
            border-radius: 3px;
            font-size: 12px;
        }
    </style>
</head>

<body>
<div class="container">
    <div class="body">
        <form id="sign">
            <div class="item">
                <div class="label">参会类型：</div>
                <div class="content">
                    <select name="type">
                        <option value="个人参展">个人参展</option>
                        <option value="企业参展">企业参展</option>
                    </select>
                </div>
            </div>
            <div class="item">
                <div class="label">是否参展：</div>
                <div class="content">
                    <input name="exhibitor" type="radio" value="是"/>是
                    <input name="exhibitor" type="radio" value="否"/>否
                </div>
            </div>
            <div class="item">
                <div class="label">单位名称：</div>
                <div class="content">
                    <input name="company" placeholder="单位名称：" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label">纳税人识别号：</div>
                <div class="content">
                    <input name="identification" placeholder="纳税人识别号：" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label">通讯地址：</div>
                <div class="content">
                    <input name="address" placeholder="通讯地址" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label">姓名：</div>
                <div class="content">
                    <input name="name" placeholder="姓名" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label">性别：</div>
                <div class="content">
                    <input name="gender" type="radio" value="男"/>男
                    <input name="gender" type="radio" value="女"/>女
                </div>
            </div>
            <div class="item">
                <div class="label">部门：</div>
                <div class="content">
                    <input name="department" placeholder="部门" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label">职务：</div>
                <div class="content">
                    <input name="position" placeholder="职务" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label">手机号码：</div>
                <div class="content">
                    <input name="phone" id="phone" placeholder="手机号码" type="text">
                </div>
            </div>
            <div class="item">
                <div class="label"></div>
                <div class="content">
                    <input id="code" placeholder="验证码" type="text">
                </div>
                <button id="dyMobileButton" class="send">发送验证码</button>
            </div>
            <div class="item">
                <div class="label">身份证号：<span class="tip">(住宿用)</span></div>
                <div class="content">
                    <input name="personid" placeholder="身份证号" type="text">
                </div>
            </div>
            <button class="submit" id="send">提交</button>

        </form>
    </div>
    <div class="footer space">
    <img src="/assets/img/index/support.png" alt="support">
</div>
<div class="tabbar">
    <a class="back" href="http://yaoqinghan.wee360vr.cn/">
        <i class="icon icon-home"></i>
        <span>首页</span>
    </a>
    <a class="sign" href="/index/index/sign">
        <i class="icon icon-edit"></i>
        <span>报名</span>
    </a>
</div>

</div>
</body>
<script src="/assets/js/index/jquery-3.4.1.min.js"></script>
<script src="https://static.runoob.com/assets/jquery-validation-1.14.0/dist/jquery.validate.min.js"></script>
<script>
$(document).ready(function(){
	
		$("#sign").validate({
			rules: {
				type: {
					required: true
				},
				exhibitor:{
					required: true			
				},
				company:{
					required:true
				},
				identification:{
					required:true
				},
				address:{
					required:true
				},
				name:{
					required:true
				},
				gender:{
					required:true
				},
				department:{
					required:true
				},
				position:{
					required:true
				},
				phone:{
					required:true
				},
				personid:{
					required:true
				}
			},
			messages: {
				type: {
					required: "请选择参选类型"
				},
				exhibitor: {
					required: "请选择是否参展"
				},
				company:{
					required: "请输入公司名"
				},
				identification:{
					required: "请输入纳税号"
				},
				address:{
					required: "请输入地址"
				},
				name:{
					required: "请输入姓名"
				},
				gender:{
					required: "请选择性别"
				},
				department:{
					required: "请输入部门"
				},
				position:{
					required: "请输入职位"
				},
				phone:{
					required: "请输入手机号码"
				},
				personid:{
					required: "请输入身份证"
				}
			},
	        errorPlacement: function(error, element) {
	        	if(element.is(':radio')||element.is(':checkbox')) {
	        		
	        		error.appendTo(element.parent());
					return false;
	        	}else{
		        
		        	error.insertAfter(element);
					return false;
	        	}
	        } 
		});
	});


    var vercode = 0;
    var time = 60;
    var flag = true;   //设置点击标记，防止60内再次点击生效

    //发送验证码
    $('#dyMobileButton').click(function () {
        var phone = $('#phone').val();
        if (!(/^1[3456789]\d{9}$/.test(phone))) {
            alert("手机号码有误，请重填");
            return false;
        }
        if (flag) {
            $(this).attr("disabled", true);
            var timer = setInterval(function () {

                if (time == 60 && flag) {
                    flag = false;

                    $.ajax({
                        type: 'get',
                        async: false,
                        url: '/index/index/getauthmsg',
                        data: {
                            "phone": phone
                        },
                        dataType: "json",
                        success: function (data) {
                            if (data.status == 0) {
                                vercode = data.data;
                                alert(vercode)
                                $("#dyMobileButton").html("已发送");
                            } else {
                                flag = true;
                                time = 60;
                                clearInterval(timer);
                            }
                        }
                    });
                } else if (time == 0) {
                    $("#dyMobileButton").removeAttr("disabled");
                    $("#dyMobileButton").html("发送验证码");
                    clearInterval(timer);
                    time = 60;
                    flag = true;
                } else {
                    $("#dyMobileButton").html(time + " s 重新发送");
                    time--;
                }
            }, 1000);
        }

    });

    //手机号注册
    $("#send").click(function () {
        var reader_com_check = $('#reader-me').attr("checked");

        var code = $('#code').val();
        if (vercode != code||code=="") {
            alert("请输入正确的验证码");
            $('#code').val("");
			return false;
        } else {
            var type = $('select[name= "type"]').val();
            var exhibitor = $('input[name= "exhibitor"]:checked').val();
            var company = $('input[name= "company"]').val();
            var identification = $('input[name= "identification"]').val();
            var address = $('input[name= "address"]').val();
            var name = $('input[name= "name"]').val();
            var gender = $('input[name= "gender"]:checked').val();
            var department = $('input[name= "department"]').val();
            var position = $('input[name= "position"]').val();
            var phone = $('input[name= "phone"]').val();
            var personid = $('input[name= "personid"]').val();
            var form = new FormData();
            form.append("type", type);
            form.append("company", company);
            form.append("exhibitor", exhibitor);
            form.append("identification", identification);
            form.append("name", name);
            form.append("gender", gender);
            form.append("address", address);
            form.append("department", department);
            form.append("position", position);
            form.append("phone", phone);
            form.append("personid", personid);
            $.ajax({
                url: "./signed",
                type: "post",
                data: form,
                processData: false,
                contentType: false,
                success: function (data) {
					alert(data
                    if (data.status == 0) {
                        window.location.href="./index";
                    } else if (data.status == 1) {
                        alert(data.msg);
                    }

                },
                error: function (e) {
                    alert("错误提交！");

                }
            });
        }
    });


</script>

</html>