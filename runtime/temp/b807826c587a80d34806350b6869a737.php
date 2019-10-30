<?php if (!defined('THINK_PATH')) exit(); /*a:3:{s:83:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\public/../application/index\view\index\expert.html";i:1572419798;s:72:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\head.html";i:1572367651;s:74:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\index\view\common\footer.html";i:1572369561;}*/ ?>
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
        .body {
            width: 100%;
        }
        .search-wrap {
            padding: 5px 15px;
            border-bottom:1px solid #e8e8e8;
        }
        .search-wrap .main {
            display: flex;
            align-items: center;
            padding: 6px 10px;
            border:1px solid #e8e8e8;
            border-radius: 50px;
        }
        .search-wrap .main .icon-search{
            flex: 0 0 15px;
            display: block;
            width: 15px;
            height: 15px;
            margin-right: 5px;
            background-repeat: no-repeat;
            background-size: contain;
            background-position: center;
            background-image: url('http://yaoqinghan.wee360vr.cn/assets/img/index/icon-search.png');
        }
        .search-wrap input {
            flex: 1;
            border: none;
            outline: none;
        }
        .item {
            display: flex;
            align-items: center;
            box-sizing: border-box;
            padding: 8px 10px;
            border-bottom:1px solid #e8e8e8;
        }
        .item:last-child{
            border-bottom: none;
        }
        .item .img {
            flex: 0 0 60px;
            width: 60px;
            height: 60px;
            margin-right: 10px;
            border-radius: 50%;
        }
        .item .desc {
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            color: #999;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="body">
            <div class="search-wrap">
                <div class="main">
                        <i class="icon icon-search"></i>
                        <input placeholder="请输入嘉宾名称" type="text">
                </div>
            </div>
            <div class="list">
                <?php if(is_array($expert) || $expert instanceof \think\Collection || $expert instanceof \think\Paginator): $i = 0; $__LIST__ = $expert;if( count($__LIST__)==0 ) : echo "" ;else: foreach($__LIST__ as $key=>$expert): $mod = ($i % 2 );++$i;?>
                <a class="item" href="./expert_details?id=<?php echo $expert['id']; ?>">
                    <img src="<?php echo $expert['image']; ?>" alt="" class="img">
                    <div class="info">
                        <div class="name"><?php echo $expert['name']; ?></div>
                        <div class="title"><?php echo $expert['title']; ?></div>
                        <div class="desc"><?php echo $expert['introduce']; ?></div>
                    </div>
                </a>
                <?php endforeach; endif; else: echo "" ;endif; ?>
                
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