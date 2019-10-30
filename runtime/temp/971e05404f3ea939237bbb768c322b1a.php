<?php if (!defined('THINK_PATH')) exit(); /*a:4:{s:80:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\public/../application/admin\view\sign\edit.html";i:1572409884;s:75:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\admin\view\layout\default.html";i:1572338451;s:72:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\admin\view\common\meta.html";i:1572338451;s:74:"C:\UPUPW_AP5.6\vhosts\yaoqinghan\application\admin\view\common\script.html";i:1572338451;}*/ ?>
<!DOCTYPE html>
<html lang="<?php echo $config['language']; ?>">
    <head>
        <meta charset="utf-8">
<title><?php echo (isset($title) && ($title !== '')?$title:''); ?></title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="renderer" content="webkit">

<link rel="shortcut icon" href="/assets/img/favicon.ico" />
<!-- Loading Bootstrap -->
<link href="/assets/css/backend<?php echo \think\Config::get('app_debug')?'':'.min'; ?>.css?v=<?php echo \think\Config::get('site.version'); ?>" rel="stylesheet">

<!-- HTML5 shim, for IE6-8 support of HTML5 elements. All other JS at the end of file. -->
<!--[if lt IE 9]>
  <script src="/assets/js/html5shiv.js"></script>
  <script src="/assets/js/respond.min.js"></script>
<![endif]-->
<script type="text/javascript">
    var require = {
        config:  <?php echo json_encode($config); ?>
    };
</script>
    </head>

    <body class="inside-header inside-aside <?php echo defined('IS_DIALOG') && IS_DIALOG ? 'is-dialog' : ''; ?>">
        <div id="main" role="main">
            <div class="tab-content tab-addtabs">
                <div id="content">
                    <div class="row">
                        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12">
                            <section class="content-header hide">
                                <h1>
                                    <?php echo __('Dashboard'); ?>
                                    <small><?php echo __('Control panel'); ?></small>
                                </h1>
                            </section>
                            <?php if(!IS_DIALOG && !$config['fastadmin']['multiplenav']): ?>
                            <!-- RIBBON -->
                            <div id="ribbon">
                                <ol class="breadcrumb pull-left">
                                    <li><a href="dashboard" class="addtabsit"><i class="fa fa-dashboard"></i> <?php echo __('Dashboard'); ?></a></li>
                                </ol>
                                <ol class="breadcrumb pull-right">
                                    <?php foreach($breadcrumb as $vo): ?>
                                    <li><a href="javascript:;" data-url="<?php echo $vo['url']; ?>"><?php echo $vo['title']; ?></a></li>
                                    <?php endforeach; ?>
                                </ol>
                            </div>
                            <!-- END RIBBON -->
                            <?php endif; ?>
                            <div class="content">
                                <form id="edit-form" class="form-horizontal" role="form" data-toggle="validator" method="POST" action="">

    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Type'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
                        
            <select  id="c-type" class="form-control selectpicker" name="row[type]">
                <?php if(is_array($typeList) || $typeList instanceof \think\Collection || $typeList instanceof \think\Paginator): if( count($typeList)==0 ) : echo "" ;else: foreach($typeList as $key=>$vo): ?>
                    <option value="<?php echo $key; ?>" <?php if(in_array(($key), is_array($row['type'])?$row['type']:explode(',',$row['type']))): ?>selected<?php endif; ?>><?php echo $vo; ?></option>
                <?php endforeach; endif; else: echo "" ;endif; ?>
            </select>

        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Isjoin'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
                        
            <select  id="c-isjoin" class="form-control selectpicker" name="row[isjoin]">
                <?php if(is_array($isjoinList) || $isjoinList instanceof \think\Collection || $isjoinList instanceof \think\Paginator): if( count($isjoinList)==0 ) : echo "" ;else: foreach($isjoinList as $key=>$vo): ?>
                    <option value="<?php echo $key; ?>" <?php if(in_array(($key), is_array($row['isjoin'])?$row['isjoin']:explode(',',$row['isjoin']))): ?>selected<?php endif; ?>><?php echo $vo; ?></option>
                <?php endforeach; endif; else: echo "" ;endif; ?>
            </select>

        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Company'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-company" class="form-control" name="row[company]" type="text" value="<?php echo htmlentities($row['company']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Identification'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-identification" class="form-control" name="row[identification]" type="text" value="<?php echo htmlentities($row['identification']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Address'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-address" class="form-control" name="row[address]" type="text" value="<?php echo htmlentities($row['address']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Name'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-name" class="form-control" name="row[name]" type="text" value="<?php echo htmlentities($row['name']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Sex'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
                        
            <select  id="c-sex" class="form-control selectpicker" name="row[sex]">
                <?php if(is_array($sexList) || $sexList instanceof \think\Collection || $sexList instanceof \think\Paginator): if( count($sexList)==0 ) : echo "" ;else: foreach($sexList as $key=>$vo): ?>
                    <option value="<?php echo $key; ?>" <?php if(in_array(($key), is_array($row['sex'])?$row['sex']:explode(',',$row['sex']))): ?>selected<?php endif; ?>><?php echo $vo; ?></option>
                <?php endforeach; endif; else: echo "" ;endif; ?>
            </select>

        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Department'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-department" class="form-control" name="row[department]" type="text" value="<?php echo htmlentities($row['department']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Position'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-position" class="form-control" name="row[position]" type="text" value="<?php echo htmlentities($row['position']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Mobile'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-mobile" class="form-control" name="row[mobile]" type="number" value="<?php echo htmlentities($row['mobile']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Personid'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
            <input id="c-personid" class="form-control" name="row[personid]" type="text" value="<?php echo htmlentities($row['personid']); ?>">
        </div>
    </div>
    <div class="form-group">
        <label class="control-label col-xs-12 col-sm-2"><?php echo __('Approve'); ?>:</label>
        <div class="col-xs-12 col-sm-8">
                        
            <select  id="c-approve" class="form-control selectpicker" name="row[approve]">
                <?php if(is_array($approveList) || $approveList instanceof \think\Collection || $approveList instanceof \think\Paginator): if( count($approveList)==0 ) : echo "" ;else: foreach($approveList as $key=>$vo): ?>
                    <option value="<?php echo $key; ?>" <?php if(in_array(($key), is_array($row['approve'])?$row['approve']:explode(',',$row['approve']))): ?>selected<?php endif; ?>><?php echo $vo; ?></option>
                <?php endforeach; endif; else: echo "" ;endif; ?>
            </select>

        </div>
    </div>
    <div class="form-group layer-footer">
        <label class="control-label col-xs-12 col-sm-2"></label>
        <div class="col-xs-12 col-sm-8">
            <button type="submit" class="btn btn-success btn-embossed disabled"><?php echo __('OK'); ?></button>
            <button type="reset" class="btn btn-default btn-embossed"><?php echo __('Reset'); ?></button>
        </div>
    </div>
</form>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <script src="/assets/js/require<?php echo \think\Config::get('app_debug')?'':'.min'; ?>.js" data-main="/assets/js/require-backend<?php echo \think\Config::get('app_debug')?'':'.min'; ?>.js?v=<?php echo htmlentities($site['version']); ?>"></script>
    </body>
</html>