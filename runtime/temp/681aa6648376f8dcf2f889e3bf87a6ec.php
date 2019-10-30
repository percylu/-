<?php if (!defined('THINK_PATH')) exit(); /*a:3:{s:91:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\public/../application/index\view\index\expert_details.html";i:1572419577;s:72:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\head.html";i:1572367651;s:74:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\footer.html";i:1572369561;}*/ ?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>专家介绍</title>
    <link rel="stylesheet" href="/assets/css/index/reset.css">
<link rel="stylesheet" href="/assets/css/index/common.css">

    <style>
        .pic {
            text-align: center;
        }
        .pic img{
            width: 100px;
            height: 100px;
            border-radius: 50%;
            margin-top: 20px;
        }
        h3{
            text-align: center;
            margin: 8px 0;
        }
        .content {
            color: #999;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="body">
            <div class="pic">
                <img src="<?php echo $expert['image']; ?>" alt="">
            </div>
            <h3><?php echo $expert['name']; ?></h3>
            <div class="content">
                <?php echo $expert['content']; ?>
            </div>
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