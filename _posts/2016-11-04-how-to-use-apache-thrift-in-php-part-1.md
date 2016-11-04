---
layout: post-minimal
title: 'RPC - Apache Thrift 입문 1부' 
date: 2016-11-04 00:00:00 +0900
categories:
- work-n-play
tags:
- 개발자
- rpc
- "apache thrift"
---

RPC는 REST와 함께 원격 API를 호출하는 두 가지 대표적인 방법 중 하나다. REST가 API를 원격 서버에 있는 리소스(모델 또는 데이터)에 대한 상태 교환이라고 생각하는 반면, RPC는 원격 서버의 함수를 호출한다고 생각한다. 그래서 REST에서는 `/posts/{id}`와 같이 원격 서버에 리소스에 접근할 수 있는 통로를 제공하고 클라이언트가 `GET /posts/{id}`처럼 API 엔드포인트를 통해 원격 서버의 리소스에 접근하는 반면, RPC에서는 API 엔드포인트는 가령 `POST /posts`처럼 하나로 고정해 놓고, 원격 서버와 클라이언트가 공통으로 사용하는 라아브러리를 시용해서 `$client->find($id)`와 같이 통신한다. 

이 포스트에서는 PHP 프로젝트에서 Apache Thrift RPC 시스템을 사용하는 방법을 설명한다.

**`CAVEAT`** 게시판 서비스를 만드는데 RPC를 절대 쓰지 말자! 속도나 강건함을 얻는 대신 디버깅의 편리함을 포기해야 한다. 특히 Thrift는 문서가 부실하므로 검색과 삽질에 익숙하지 않다면 말리고 싶다.  

<!--more-->
<div class="spacer">• • •</div>

## 1. 왜?

웹 API는 클라이언트와 서버가 통신하기 위한 방법 또는 규격이다. 클라이언트가 HTTP 프로토콜을 통해 직렬화된 데이터를 보내면 서버가 받은 데이터를 역직렬화해서 클라이언트의 요청을 이해한다. 송신자의 요청을 처리하기 위헤 데이터베이스에 접근하고, 데이터를 가공/처리해서 JSON/XML 형태로 직렬화해서 다시 HTTP 프로토콜로 응답한다. 모든 과정을 순조롭다. 그런데 우리가 개발하는 API는 구글, 페이스북, 깃허브등이 하는 오픈 API가 아니라, 자체 서비스를 위한 내부 API라는 점이다.  

HTTP + JSON/XML은 검증된 공식이다. 자바냐, 파이썬이냐 등등 플랫폼 의존성도 신경쓸 필요없는 만국 공용어 같은 녀석이다. 그러나, 데이터 타입/구조에 대한 정의가 없다. 클라이언트와 서버 모두가 이해할 수 있는 문서를 작성해야 하고, 양쪽 코드를 모두 관리해야 한다. 게다가 JSON/XML 메시지를 해석하는 비용도 꽤 비싸다. RPC에서도 JSON 메시지를 쓸 수도 있지만, 바이너리 메시지를 더 선호한다. 이유는
 
-   서버나 클라이언트의 메모리 공간을 절약할 수 있다.
-   전송 속도가 빠르다.
-   서버측에서는 바이너리 직렬화를 위해 CPU 타임이 더 필요하지만, 클라이언트 측에서는 JSON 역직렬화에 비해 월등한 성능을 보인다.
-   호환성이 깨지지 않는다. 예전 데이터 포맷으로 새 서버에 요청해도 작동한다. 새 클라이언트로 예전 서버에 요청하는 경우에도 작동한다.

물론 새로운 것을 배워야 하고 메시지 패킷을 직접 정의해야 하는 번거로움이 있다. 익숙해지기 전까지는, 이 과정에서 에러와의 사투를 벌여야한다.

## 2. 다른 RPC 프레임워크

Apache Thrift 외에도 선택지가 꽤 있다.

-   프로토콜 버퍼(Protocol Buffers)
    -   구글이 개발
    -   2008년에 BSD 라이선스로 오픈 소스
    -   구글 프로덕션에서 사용. 우리가 검색 요청을 할 때마다 프로토콜 버퍼가 작동함
    -   공식적으로 C++/Java/Python/Javascript만 지원하지만, 커뮤니티에서 제공하는 다른 언어용 프로젝트도 있음
    -   문서가 훌륭하고, 커뮤니티 활동도 활발함
    -   구글, ActiveMQ, Netty 등에서 사용
    
-   Apache Thrift
    -   x-Googler가 페이스북에 입사하여 많듬
    -   2007년에 Apache License로 오픈 소스
    -   현존하는 RPC 스택 중 가장 많은 언어 공식 지원
    -   RPC 콜을 위한 풀 스택을 지원하므로 트랜스포트를 직접 쓸 필요가 없다. 심지어 클라이언트/서버 코드도 생성해 준다
    -   문서는 부실하고, 버전업 속도가 상대적으로 느린 편
    -   페이스북, 에버노트, LastFM 등에서 사용
    
-   기타
    -   Apache AVRO, GRPC 외

## 3. 워크플로우

REST든 RPC든 마찬가지다. 모범 사례는 서버와 클라이언트간의 약속을 가장 먼저 정하는 일이다. 

-   메시지 형식 및 서비스 인터페이스 작성. RPC 프레임워크들은 인터페이스를 정의하기 위해 스스로 정의한 IDL(Interface Definition Language)를 제공한다.
-   프레임워크에서 제공하는 툴(컴파일러)를 이용해서 여러 언어용으로 보일러플레이트 코드 생성
-   생성된 보일러플레이트 코드를 애플리케이션으로 끌어 와서 기능 개발

이 워크플로우대로 차근차근 PHP 언어에서 Apache Thrift를 이용한 프로젝트를 만드는 법을 설명한다.

## 4. 인터페이스 작성

IDL 문법은 공식 문서에는 없다. [https://diwakergupta.github.io/thrift-missing-guide/](https://diwakergupta.github.io/thrift-missing-guide/)에 자세히 나와 있다. 전체 문법 중 일부만 사용하지만, 코드를 보면서 이해하는 것이 쉽울 것이다.

```thrift
// https://github.com/appkr/thrift-example-idl/blob/master/src/Post.thrift

include "Errors.thrift"                 // Errors.thrfit 파일을 임포트 한다.

namespace php Appkr.Thrift.Post         // PHP용 네임스페이스를 정의한다.
namespace java kr.appkr.thrift.post     // 다른 언어도 정의할 수 있다는 것을 보여 주기 위해서
                                        // 쓰지는 않지만, 자바 패키지를 정의했다.

/**
 * Post 엔티티
 */
struct Post {                           // Post 메시지 타입을 정의한다. 
                                        // 모델이라 볼 수도 있고, 필요한 데이터만 간추린 DTO라 볼 수도 있다.
    /** 기본 키 */
    1: optional i32 id,                 // 번호는 클라인트-서버간 통신 및 버전간 호환성 유지를 위해 꼭 필요하다.
                                        // 꼭 필요한 필드라면 required, 그렇지 않다면 optional 키워드를 쓴다.

    /** 포스트 제목 */
    2: optional string title,

    /** 포스트 본문 */
    3: optional string content,

    /** 포스트 최초 생성 시각 */
    4: optional string created_at,

    /** 포스트 최종 수정 시각 */
    5: optional string updated_at
}

/**
 * Post 엔티티의 필드들
 */
enum PostField {                        // enum 필드는 PHP에서 클래스 상수로 변환된다.
    /** 제목 필드 */
    TITLE = 1,                          // 메시지 정의할 때는 콜론(:), enum에서는 등호(=)를 사용한다.
                                        // enum의 값으로 연속된 정수를 쓸 필요는 없다.
    /** 본문 필드 */
    CONTENT = 2,

    /** 최초 생성 시각 */
    CREATED_AT = 3,

    /** 최종 수정 시각 */
    UPDATED_AT = 4,
}

/**
 * 정렬 방향
 */
enum SortDirection {
    /** 오름 차순 */
    ASC = 1,

    /** 내림 차순 */
    DESC = 2,
}

/**
 * PostCollection 엔티티
 */
typedef list<Post> PostCollection       // Thrift 기본 타입 외 커스텀 타입을 정의할 수 있다.

/**
 * 쿼리 필터 엔티티
 */
struct QueryFilter {
    /** 검색할 키워드 */
    1: optional string keyword = '',

    /** 정렬 기준이 되는 필드 */
    2: optional PostField sortBy = PostField.CREATED_AT,

    /** 정렬 방향 */
    3: optional SortDirection sortDirection = SortDirection.DESC
}

/**
 * Post 서비스
 */
service PostService {                   // 서비스를 정의한다.
                                        // 여기서 앞서 정의한 메시지와 enum을 사용한다.
    /**
     * 포스트 목록을 응답합니다.
     */
    PostCollection all(
        1: QueryFilter qf,              // 객체형 메서드 인자
        2: i32 offset = 0,
        3: i32 limit = 10
    ) throws (
        1: Errors.UserException userException,
                                        // 임포트한 다른 네임스페이스의 메시지 타입을 참조할 때 점(.)을 이용한다.
        2: Errors.SystemException systemException
                                        // 예외를 담을 변수 이름을 서로 다르게 사용해야 한다. 
    ),

    /**
     * 특정 포스트의 상세 정보를 응답합니다.
     */
    Post find(
        1: i32 id
    ) throws (
        1: Errors.UserException userException
        2: Errors.SystemException systemException
    ),

    /**
     * 새 포스트를 만듭니다.
     */
    Post store(
        1: string title,
        2: string content
    ) throws (
        1: Errors.UserException userException
        2: Errors.SystemException systemException
    )
}
```

`Post.thrift`에서 참조한 `Errors.thrift`는 [예제 프로젝트](https://github.com/appkr/thrift-example-idl/blob/master/src/Errors.thrift)에서 찾을 수 있다.

지금 IDL 프로젝트의 파일 목록은 다음과 같다.

```sh
~/thrift-example-idl/src
                    ├── Errors.thrift
                    └── Post.thrift
```

## 5. 컴파일해서 보일러 플레이트 코드 생성

IDL 작성이 끝나면 컴파일러 바이너리로 보일러 플레이트 코드를 생성한다. OS X 컴퓨터에서는 홈브루로 설치할 수 있는데, 이 포스트를 작성 시점의 `thrift` 바이너리는 PHP의 PSR4를 지원하지 않는 0.9.3 버전이다. 따라서 Thrift 프로젝트의 `dev-master 1.0.0-candidate` 소스를 받아서 컴파일해야하는데 맥에서는 여간 어려운 일이 아니다. 

따라서 [맥에서 미리 컴파일해놓은 파일을 여기서 다운로드](/files/thrift-osx.gz) 받아 사용할 것을 권장한다. 다운로드 받은 파일 압축을 풀고 `/usr/local/bin` 디렉터리로 옮기고 실행 권한을 설정해 준다.

```sh
~ $ mv thrift /usr/local/bin/
~ $ chmod 755 /usr/local/bin/thrift
~ $ thrift --version
# Thrift version 1.0.0-dev
```

이제 컴파일해 보자. 아무런 에러 피드백 없이 명령이 끝났다면 성공한 것이다.

```sh
~/thrift-example-idl $ thrift -r --gen php:server,psr4 src/Post.thrift
```

`-r`은 인클루드(임포트)한 파일까지도 컴파일한다는 의미고, `--gen`은 `language:key1[=val1]` 형식으로 쓴다. 가령 자바 코드로 컴파일한다면 `--gen java`처럼 쓰면 된다. 컴파일된 결과를 확인해 보자.

```sh
~/thrift-example-idl
├── gen-php
│   └── Appkr
│       └── Thrift
│           ├── Errors
│           │   ├── ErrorCode.php
│           │   ├── SystemException.php
│           │   └── UserException.php
│           └── Post
│               ├── Post.php
│               ├── PostField.php
│               ├── PostServiceClient.php
│               ├── PostServiceIf.php
│               ├── PostServiceProcessor.php
│               ├── PostService_all_args.php
│               ├── PostService_all_result.php
│               ├── PostService_find_args.php
│               ├── PostService_find_result.php
│               ├── PostService_store_args.php
│               ├── PostService_store_result.php
│               ├── QueryFilter.php
│               └── SortDirection.php
└── src
```

예제 프로젝트에서는 컴파일하고 디렉터리 이름을 바꾸는 등의 모든 작업을 `Makefile`로 작성해 두었다. 자바 컴파일도 포함하고 있다. 해서 다음 명령으로 간단히 작업을 수행할 수 있다. 

```sh
~/thrift-example-idl $ make clean
# rm -rf lang/java/build lang/java/post-thrift.jar
# rm -rf gen-* dist-* docs
~/thrift-example-idl $ make
# rm -rf lang/java/build lang/java/post-thrift.jar
# rm -rf gen-* dist-* docs
# thrift -r --gen php:server,psr4 src/Post.thrift
# thrift -r --gen java src/Post.thrift
# ...
# mkdir -p docs
# thrift -r --gen html:standalone -out docs src/Post.thrift
# mv gen-php dist-php
```

`Makefile`에서는 IDL 문서도 HTML로 생성해 주는데 아래 그림처럼 생겼다.

[![방송하기](/images/2016-11-04-img-01.png)](/images/2016-11-04-img-01.png)

## x. 결론

- 클라이언트는 편하다.
- 클라이언트가 문서를 읽고 데이터 형식에 맞추거나, 서버가 데이터 형식에 대한 유효성을 검사하는데 신경을 덜 쓸 수 있다. 

