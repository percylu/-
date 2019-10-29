<?php if (!defined('THINK_PATH')) exit(); /*a:1:{s:68:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\addons\alisms\view\index\index.html";i:1572340589;}*/ ?>
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html;charset=UTF-8"/>
    <title>阿里云通信短信发送示例 - FastAdmin</title>

    <!-- Bootstrap Core CSS -->
    <link href="https://cdn.staticfile.org/twitter-bootstrap/3.3.7/css/bootstrap.min.css" rel="stylesheet">

    <!-- Custom CSS -->
    <link href="/assets/css/frontend.css" rel="stylesheet">

    <!-- Plugin CSS -->
    <link href="https://cdn.staticfile.org/font-awesome/4.7.0/css/font-awesome.min.css" rel="stylesheet">
    <link href="https://cdn.staticfile.org/simple-line-icons/2.4.1/css/simple-line-icons.min.css" rel="stylesheet">

    <!-- HTML5 Shim and Respond.js IE8 support of HTML5 elements and media queries -->
    <!--[if lt IE 9]>
    <script src="https://cdn.staticfile.org/html5shiv/3.7.3/html5shiv.min.js"></script>
    <script src="https://cdn.staticfile.org/respond.js/1.4.2/respond.min.js"></script>
    <![endif]-->
</head>
<body>
<div class="container">
    <div class="well" style="margin-top:30px;">
        <form class="form-horizontal" action="<?php echo addon_url('alisms/index/send'); ?>" method="POST">
            <fieldset>
                <legend>阿里云通信短信发送</legend>
                <div class="form-group">
                    <label class="col-lg-2 control-label">手机号</label>
                    <div class="col-lg-10">
                        <input type="text" class="form-control" name="mobile" placeholder="手机号">
                    </div>
                </div>
                <div class="form-group">
                    <label class="col-lg-2 control-label">消息模板ID</label>
                    <div class="col-lg-10">
                        <input type="text" class="form-control" name="template" placeholder="消息模板ID，从阿里云通信获得，通常是：SMS_114000000这种格式">
                    </div>
                </div>
                <div class="form-group">
                    <label class="col-lg-2 control-label">签名</label>
                    <div class="col-lg-10">
                        <input type="text" class="form-control" name="sign" placeholder="消息模板(可以留空,留空使用后台插件管理中的配置)">
                    </div>
                </div>
                <div class="form-group">
                    <label class="col-lg-2 control-label">模板变量参数</label>
                    <div class="col-lg-10">
                        <textarea name="param" class="form-control" cols="30" rows="10" placeholder='必须是JSON字符串,如{"name":"李明"}'></textarea>
                    </div>
                </div>
                <div class="form-group">
                    <div class="col-lg-10 col-lg-offset-2">
                        <button type="submit" class="btn btn-primary">发送</button>
                        <button type="reset" class="btn btn-default">重置</button>
                    </div>
                </div>
            </fieldset>
        </form>
    </div>
</div>
<!-- jQuery -->
<script src="https://cdn.staticfile.org/jquery/2.1.4/jquery.min.js"></script>

<!-- Bootstrap Core JavaScript -->
<script src="https://cdn.staticfile.org/twitter-bootstrap/3.3.7/js/bootstrap.min.js"></script>

<script type="text/javascript">
    $(function () {

    });
</script>
</body>
</html>