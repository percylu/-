<?php if (!defined('THINK_PATH')) exit(); /*a:3:{s:84:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\public/../application/index\view\index\message.html";i:1572447628;s:72:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\head.html";i:1572367651;s:74:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\footer.html";i:1572369561;}*/ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>建议留言</title>
    <link rel="stylesheet" href="/assets/css/index/reset.css">
<link rel="stylesheet" href="/assets/css/index/common.css">

    <style>
        h5 {
            font-weight: 300;
            margin-bottom: 5px;
        }
        .textarea {
            margin-top: 15px;
            width: 100%;
        }
        textarea {
            width: 100%;
            padding: 5px;
            border-color: #ccc;
            box-sizing: border-box;
        }
        button {
            display: block;
            width: 90%;
            padding: 10px 0;
            margin: 100px auto 0 auto;
            border: none;
            border-radius: 5px;
            background-color: #027ad9;
            color: #fff;
        }
        input {
            width: 100%;
            padding: 10px 5px;
            border: 1px solid #ccc;
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="body">
		<form action="./message" method="post" >
        <div class="textarea">
            <textarea name="content" placeholder="请填写你的建议" cols="30" rows="10"></textarea>
        </div>
        <h5>请留下你的联系方式：</h5>
        <input name="contact" type="text" placeholder="qq/手机号/邮箱">
        
        <button type="submit">确定</button>
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
</html>