import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, Button, Card, Flex, QRCode, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import illustration from '@/assets/login/rehab-collaboration.png';
import {
  authErrorMessage,
  getSession,
  login,
  type Verification,
} from '@/services/rehab/auth';
import { localRoute, safeReturnPath } from '@/services/rehab/session';

type LoginValues = { username: string; password: string; otp: string };
type Challenge = { id: string; account: string; verification: Verification };

const useStyles = createStyles(({ token }) => ({
  page: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: token.colorBgContainer,
  },
  header: {
    padding: `${token.paddingLG}px ${token.paddingXL + token.padding}px`,
    borderBottom: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
    [`@media (max-width: ${token.screenSMMax}px)`]: {
      padding: token.paddingLG,
    },
  },
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(360px, 0.95fr)',
    gap: token.marginXXL,
    alignItems: 'center',
    width: '100%',
    maxWidth: 1440,
    marginInline: 'auto',
    padding: `${token.paddingXL}px ${token.paddingXL + token.padding}px`,
    [`@media (max-width: ${token.screenMDMax}px)`]: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: token.marginLG,
      padding: token.paddingLG,
    },
  },
  introduction: {
    minWidth: 0,
    [`@media (max-width: ${token.screenMDMax}px)`]: {
      textAlign: 'center',
    },
    [`@media (max-width: ${token.screenSMMax}px)`]: {
      display: 'none',
    },
  },
  illustration: {
    display: 'block',
    width: '100%',
    height: 'auto',
    marginTop: token.marginLG,
    [`@media (max-width: ${token.screenMDMax}px)`]: {
      display: 'none',
    },
  },
  card: {
    width: '100%',
    maxWidth: 560,
    justifySelf: 'end',
  },
  cardBody: {
    padding: token.paddingXL + token.paddingXS,
    [`@media (max-width: ${token.screenSMMax}px)`]: {
      padding: token.paddingLG,
    },
  },
  formHeading: {
    marginBottom: token.marginXL,
  },
  notices: {
    marginBottom: token.marginLG,
  },
  footer: {
    padding: token.paddingLG,
    textAlign: 'center',
    borderTop: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`,
  },
}));

export default function Login() {
  const { styles } = useStyles();
  const { setInitialState } = useModel('@@initialState');
  const [error, setError] = useState('');
  const [challenge, setChallenge] = useState<Challenge>();
  const [resetRequired, setResetRequired] = useState(false);
  const submit = async (values: LoginValues) => {
    setError('');
    try {
      const result = await login(
        challenge
          ? { tmp_id: challenge.id, otp: values.otp }
          : { usr: values.username.trim(), pwd: values.password },
      );
      if (result.verification && result.tmp_id) {
        setChallenge({
          id: result.tmp_id,
          account: challenge?.account || values.username,
          verification: result.verification,
        });
        if (result.verification.token_delivery === false)
          setError('验证码未能发送，请联系管理员核对。');
        return false;
      }
      if (result.message === 'Password Reset') {
        setResetRequired(true);
        return false;
      }
      if (
        !['logged in', 'no app'].includes(result.message?.toLowerCase() || '')
      ) {
        setError('登录尚未完成，请联系管理员核对账号状态。');
        return false;
      }
      const user = await getSession();
      await setInitialState((state) => ({
        ...state,
        currentUser: user,
        authFailure: undefined,
      }));
      history.replace(
        localRoute(
          safeReturnPath(
            new URLSearchParams(window.location.search).get('redirect'),
          ),
        ),
      );
      return true;
    } catch (failure) {
      setError(authErrorMessage(failure));
      return false;
    }
  };
  const secret = challenge?.verification.otp_secret;
  return (
    <div className={styles.page}>
      <Helmet>
        <title>登录 · 医院康复管理系统</title>
      </Helmet>
      <header className={styles.header}>
        <Flex align="center" gap="middle">
          <img
            src="/assets/rehab/images/rehab.svg"
            alt=""
            width={40}
            height={40}
          />
          <Typography.Title level={3} style={{ margin: 0 }}>
            医院康复管理系统
          </Typography.Title>
        </Flex>
      </header>
      <main className={styles.main}>
        <section className={styles.introduction} aria-label="康复诊疗协作">
          <Typography.Title level={1} style={{ marginTop: 0 }}>
            康复诊疗，协同管理
          </Typography.Title>
          <Typography.Text type="secondary">
            医嘱与评估 · 治疗与排班 · 团队与资源
          </Typography.Text>
          <img
            className={styles.illustration}
            src={illustration}
            alt="治疗师协助患者开展康复步行训练"
            decoding="async"
          />
        </section>
        <Card className={styles.card} classNames={{ body: styles.cardBody }}>
          <LoginForm<LoginValues>
            key={
              challenge
                ? challenge.id + (secret ? '-setup' : '-verify')
                : 'password'
            }
            title={false}
            subTitle={false}
            contentStyle={{ width: '100%', minWidth: 0 }}
            containerStyle={{ padding: 0 }}
            actions={
              <Typography.Text type="secondary">
                账号问题请联系医院系统管理员
              </Typography.Text>
            }
            otherStyle={{ textAlign: 'center' }}
            submitter={{
              searchConfig: { submitText: challenge ? '验证并登录' : '登录' },
              submitButtonProps: { disabled: resetRequired },
            }}
            onFinish={submit}
          >
            <div className={styles.formHeading}>
              <Typography.Title
                level={2}
                style={{ margin: 0, marginBottom: 8 }}
              >
                {challenge ? '安全验证' : '账号登录'}
              </Typography.Title>
              <Typography.Text type="secondary">
                使用医院授权账号登录
              </Typography.Text>
            </div>
            {error && (
              <div className={styles.notices}>
                <Alert type="error" showIcon title={error} />
              </div>
            )}
            {resetRequired && (
              <div className={styles.notices}>
                <Alert
                  type="warning"
                  showIcon
                  title="当前密码需要更新，请联系管理员重置。"
                />
              </div>
            )}
            {challenge ? (
              <>
                <Alert
                  type="info"
                  showIcon
                  title={
                    secret
                      ? '请使用验证器扫描二维码，再输入动态验证码。'
                      : challenge.verification.prompt ||
                        '请输入验证器生成的动态验证码。'
                  }
                />
                {secret && (
                  <QRCode
                    value={
                      'otpauth://totp/' +
                      encodeURIComponent(challenge.account) +
                      '?secret=' +
                      encodeURIComponent(secret) +
                      '&issuer=' +
                      encodeURIComponent(window.location.hostname)
                    }
                  />
                )}
                <ProFormText
                  name="otp"
                  label="验证码"
                  fieldProps={{
                    size: 'large',
                    autoComplete: 'one-time-code',
                    inputMode: 'numeric',
                  }}
                  rules={[{ required: true, message: '请输入验证码' }]}
                />
                <Button
                  type="link"
                  onClick={() => {
                    setChallenge(undefined);
                    setError('');
                  }}
                >
                  重新输入账号密码
                </Button>
              </>
            ) : (
              <>
                <ProFormText
                  name="username"
                  label="账号"
                  placeholder="请输入医院账号"
                  fieldProps={{
                    size: 'large',
                    prefix: <UserOutlined />,
                    autoComplete: 'username',
                  }}
                  rules={[
                    { required: true, whitespace: true, message: '请输入账号' },
                  ]}
                />
                <ProFormText.Password
                  name="password"
                  label="密码"
                  placeholder="请输入密码"
                  fieldProps={{
                    size: 'large',
                    prefix: <LockOutlined />,
                    autoComplete: 'current-password',
                  }}
                  rules={[{ required: true, message: '请输入密码' }]}
                />
              </>
            )}
          </LoginForm>
        </Card>
      </main>
      <footer className={styles.footer}>
        <Typography.Text type="secondary">医护人员工作平台</Typography.Text>
      </footer>
    </div>
  );
}
